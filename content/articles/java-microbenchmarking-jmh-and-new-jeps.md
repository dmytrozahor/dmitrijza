---
title: 'Microbenchmarking Java with JMH in the age of new JEPs'
description: 'How to measure Java code correctly with JMH, and how virtual threads, compact object headers, AOT caches, the Vector API and lazy constants change what a benchmark actually tells you.'
date: 2026-10-11
category: programming
tags: [java, jvm, performance, jmh, benchmarking]
illustration: layers
---

The JVM has never been a good place for a stopwatch. A method gets interpreted, then compiled by C1, then recompiled
by C2 with profile-guided optimizations, maybe deoptimized, then compiled again. The garbage collector runs whenever it
needs to. Wrapping a loop in `System.nanoTime()` gives you a number, but you can't tell which of those phases it
measured.

[JMH](https://github.com/openjdk/jmh), the Java Microbenchmark Harness, is the OpenJDK project's answer to this. The
JDK engineers use it for their own work, and it has a
[microbenchmark suite inside the JDK repository](https://openjdk.org/jeps/230). Knowing JMH matters even more now than
it did a few years ago. Every recent JDK release ships features that change what you measure: virtual threads that no
longer pin on `synchronized`, object headers that shrink, caches that move warmup into a training run, and an API that
exists so the JIT can treat lazily computed values as constants.

This article covers how to write JMH benchmarks that measure what you think they measure, and then goes through the
recent JEPs that change the answers.

## Why hand-rolled timing lies

The usual first attempt looks like this:

```java
long start = System.nanoTime();
for (int i = 0; i < 1_000_000; i++) {
    compute(i);
}
long elapsed = System.nanoTime() - start;
System.out.println(elapsed / 1_000_000 + " ns/op");
```

That number has at least five problems:

- **Warmup.** The early iterations run in the interpreter and the later ones run compiled code. The average blends
  phases you never meant to compare.
- **On-stack replacement (OSR).** The loop is hot but the enclosing method was only called once, so HotSpot compiles
  the loop body *while it is running* and swaps it in mid-flight. OSR code is often optimized differently from a
  normal compilation of the same method.
- **Dead-code elimination.** If `compute(i)` has no side effects and its result is ignored, C2 can remove the call
  completely. You end up timing an empty loop.
- **Profile pollution.** Benchmark two implementations of an interface one after another in the same JVM, and the
  second one runs against a call site the JIT has already seen go megamorphic. The first one wins for reasons that
  have nothing to do with its code.
- **Timer resolution.** In
  [Nanotrusting the Nanotime](https://shipilev.net/blog/2014/nanotrusting-nanotime/), Aleksey Shipilёv shows that
  `nanoTime` costs tens of nanoseconds per call and that its granularity varies widely by platform. Effects smaller
  than that cannot be timed directly.

<div class="callout definition" data-label="Definition · Microbenchmark harness">

A harness owns the parts of a measurement you shouldn't write yourself. It forks a fresh JVM for each benchmark, runs
warmup iterations until the code reaches a steady state, calls your method from a generated loop that the JIT can't
take apart, consumes results so they can't be eliminated, and reports a score with an error estimate over several
forks.

</div>

## A first JMH benchmark

The JMH README recommends a standalone Maven project generated from the archetype, so the annotation processor and
the uber-jar packaging are set up correctly:

```bash
mvn archetype:generate \
  -DinteractiveMode=false \
  -DarchetypeGroupId=org.openjdk.jmh \
  -DarchetypeArtifactId=jmh-java-benchmark-archetype \
  -DgroupId=dev.dmytrozah \
  -DartifactId=bench \
  -Dversion=1.0

cd bench && mvn clean verify
java -jar target/benchmarks.jar
```

At the time of writing, the latest JMH release on Maven Central is **1.37**. Gradle users can apply the
community-maintained [`me.champeau.jmh`](https://github.com/melix/jmh-gradle-plugin) plugin and run `./gradlew jmh`.

Here is a complete benchmark that compares two ways of joining strings:

```java
package dev.dmytrozah.bench;

import org.openjdk.jmh.annotations.*;

import java.util.concurrent.TimeUnit;

@State(Scope.Thread)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.NANOSECONDS)
@Warmup(iterations = 5, time = 1)
@Measurement(iterations = 5, time = 1)
@Fork(3)
public class JoinBench {

    @Param({"4", "64", "1024"})
    int size;

    String[] parts;

    @Setup(Level.Trial)
    public void setUp() {
        parts = new String[size];
        for (int i = 0; i < size; i++) {
            parts[i] = "part-" + i;
        }
    }

    @Benchmark
    public String stringBuilder() {
        StringBuilder sb = new StringBuilder();
        for (String p : parts) {
            sb.append(p).append(',');
        }
        return sb.toString();
    }

    @Benchmark
    public String stringJoin() {
        return String.join(",", parts);
    }
}
```

What each annotation does:

| Annotation | What it controls |
| --- | --- |
| `@State(Scope.Thread / Benchmark / Group)` | Lifecycle and sharing of fields: one instance per thread, one for all threads, or one per thread group |
| `@Setup` / `@TearDown(Level.Trial / Iteration / Invocation)` | When fixture code runs. `Invocation` runs around every call; use it only when the operation takes milliseconds |
| `@Param` | Runs the benchmark once for each value. Write values as strings; JMH converts them to the field type |
| `@BenchmarkMode` | `Throughput`, `AverageTime`, `SampleTime` (latency distribution), `SingleShotTime` (cold run), or `All` |
| `@OutputTimeUnit` | Unit used in the report |
| `@Warmup` / `@Measurement` | Number and length of iterations. Warmup results are discarded |
| `@Fork` | Number of fresh JVMs, plus `jvmArgs`/`jvmArgsAppend` for each fork |
| `@Threads` | Number of threads calling the benchmark at the same time |

Returning the result from a `@Benchmark` method is not just style: JMH passes the return value to a `Blackhole`,
which stops the JIT from proving the result unused.

## The three classic traps

The [JMH samples](https://github.com/openjdk/jmh/tree/master/jmh-samples/src/main/java/org/openjdk/jmh/samples) are
the best tutorial on this. The pitfalls they teach are about the optimizer, not about JMH itself.

### Dead-code elimination

```java
@State(Scope.Thread)
public class DeadCodeBench {

    double x = Math.PI;

    @Benchmark
    public void wrong() {
        Math.log(x);          // result unused: C2 may remove the call
    }

    @Benchmark
    public double right() {
        return Math.log(x);   // implicitly consumed by a Blackhole
    }
}
```

If `wrong` reports roughly the same time as an empty `@Benchmark` method, the computation was eliminated. To keep
more than one value alive, take a `Blackhole` parameter and call `bh.consume(...)` on each value.

### Constant folding

If the JIT can prove an input is constant, it may compute the answer at compile time. You then measure a load of a
precomputed value:

```java
@State(Scope.Thread)
public class ConstantFoldBench {

    private static final double FOLDABLE = Math.PI;  // trusted constant
    private double input = Math.PI;                  // ordinary, non-final state field

    @Benchmark
    public double wrong() {
        return Math.log(FOLDABLE);
    }

    @Benchmark
    public double right() {
        return Math.log(input);
    }
}
```

The rule: benchmark inputs belong in non-`final` fields of a `@State` object. This rule also shows up again in the
lazy constants section below.

### Loops inside the benchmark

```java
@Benchmark
public int wrongLoop() {
    int sum = 0;
    for (int i = 0; i < 1_000; i++) {
        sum += a * b;          // invariant: hoisted, or the loop becomes 1000 * (a * b)
    }
    return sum;
}
```

The JIT unrolls, hoists, and sometimes removes loops it controls. Dividing the result by 1000 does not give you the
cost of one `a * b`. Let JMH make the calls. When the operation really is "process an array", put the array size in a
`@Param` and report the time for the whole array.

<div class="callout history" data-label="Anti-patterns · Benchmarks that lie">

- Timing code with `System.nanoTime()` in a `main` method and reporting the first run.
- `@Fork(0)`: everything runs inside the harness JVM and shares its profiles. Use it only for debugging.
- Putting expensive setup in `Level.Invocation` for a nanosecond-scale operation. The timestamps around each
  invocation then dominate the result.
- Using `@Threads(4)` on a `Scope.Benchmark` state with a mutable counter, which measures contention you didn't
  intend. JMH pads state objects against false sharing, but it can't fix your own shared arrays.
- Benchmarking on a laptop with turbo boost and thermal throttling enabled and treating a 3% difference as real.

</div>

## Running, reading, and profiling

The command-line options override annotations. A typical run:

```bash
# Filter by regex, 3 forks, 5+5 iterations, allocation profiler, JSON output
java -jar target/benchmarks.jar 'JoinBench' \
  -f 3 -wi 5 -i 5 \
  -prof gc \
  -rf json -rff join.json

# Same benchmark on another JDK, without rebuilding
java -jar target/benchmarks.jar 'JoinBench' -jvm /opt/jdk-27/bin/java

# Where does the time go? (Linux; perfasm needs perf and the hsdis disassembler)
java -jar target/benchmarks.jar 'JoinBench.stringJoin' -prof perfasm

# async-profiler integration, flame graph output
java -jar target/benchmarks.jar 'JoinBench' \
  -prof 'async:libPath=/opt/async-profiler/lib/libasyncProfiler.so;output=flamegraph'

# Cheap first look: thread states and hottest stacks
java -jar target/benchmarks.jar 'JoinBench' -prof stack
```

When you read the output:

- **Score ± Error.** The error is a 99.9% confidence interval computed across all measurement iterations of all
  forks. If two results' intervals overlap, you have not shown a difference.
- **Variance between forks.** If one fork is consistently faster than the others, the JIT took different paths in
  different JVMs (inlining decisions, code layout). More forks fix this; more iterations don't.
- **`gc.alloc.rate.norm`** from `-prof gc` is bytes allocated per operation. It is often the most stable and most
  useful number in the report, because it doesn't depend on CPU frequency or noise from other processes.
- **`-prof perfasm`** shows the hottest compiled regions with the generated assembly. It is the only way to know
  whether the loop was vectorized, whether the call was inlined, or whether the code you care about is in the profile
  at all.

<figure data-illustration="layers"><figcaption>A benchmark score sits on top of several layers: your code, JIT tiers and profiles, GC, the OS scheduler, and the CPU's frequency and caches.</figcaption></figure>

## The JDK has changed under your benchmarks

JMH hasn't changed much since 1.37. The runtime it measures has. These are the JEPs that matter most for
benchmarking, from the JDK 21 LTS to JDK 27 (GA on 15 September 2026):

<ol class="timeline">
<li><strong>JDK 12</strong> <a href="https://openjdk.org/jeps/230">JEP 230</a>: Microbenchmark Suite. JMH benchmarks live in the JDK source tree and run with <code>make test TEST="micro:…"</code>.</li>
<li><strong>JDK 21</strong> <a href="https://openjdk.org/jeps/444">JEP 444</a> Virtual Threads and <a href="https://openjdk.org/jeps/439">JEP 439</a> Generational ZGC are final.</li>
<li><strong>JDK 22</strong> <a href="https://openjdk.org/jeps/454">JEP 454</a>: the Foreign Function &amp; Memory API is final, so off-heap and native-call benchmarks become first-class.</li>
<li><strong>JDK 23</strong> <a href="https://openjdk.org/jeps/474">JEP 474</a>: ZGC uses generational mode by default.</li>
<li><strong>JDK 24</strong> <a href="https://openjdk.org/jeps/491">JEP 491</a> lets virtual threads synchronize without pinning; <a href="https://openjdk.org/jeps/483">JEP 483</a> adds AOT class loading &amp; linking; <a href="https://openjdk.org/jeps/450">JEP 450</a> adds experimental compact object headers.</li>
<li><strong>JDK 25 LTS</strong> <a href="https://openjdk.org/jeps/519">JEP 519</a> makes compact object headers a product feature; <a href="https://openjdk.org/jeps/514">JEP 514</a> and <a href="https://openjdk.org/jeps/515">JEP 515</a> add AOT command-line ergonomics and method profiling; <a href="https://openjdk.org/jeps/518">JEP 518</a> and <a href="https://openjdk.org/jeps/520">JEP 520</a> improve JFR; <a href="https://openjdk.org/jeps/521">JEP 521</a> makes generational Shenandoah a product feature; <a href="https://openjdk.org/jeps/502">JEP 502</a> previews Stable Values; <a href="https://openjdk.org/jeps/508">JEP 508</a> is the 10th Vector API incubator.</li>
<li><strong>JDK 26</strong> <a href="https://openjdk.org/jeps/526">JEP 526</a> renames Stable Values to Lazy Constants (second preview); <a href="https://openjdk.org/jeps/529">JEP 529</a> is the 11th Vector API incubator.</li>
<li><strong>JDK 27</strong> <a href="https://openjdk.org/jeps/534">JEP 534</a> makes compact object headers the default; <a href="https://openjdk.org/jeps/523">JEP 523</a> makes G1 the default GC in all environments; <a href="https://openjdk.org/jeps/531">JEP 531</a> and <a href="https://openjdk.org/jeps/537">JEP 537</a> continue Lazy Constants and the Vector API.</li>
</ol>

The common thread: **the same benchmark jar can give different answers on JDK 21, 25 and 27 even though nobody
changed the code.** When you compare across versions, record the JDK version, GC, and heap flags with the result.
Pin them explicitly with `@Fork(jvmArgsAppend = ...)`, and don't rely on ergonomics. Ergonomics changed in JDK 27:
under JEP 523, a container with one CPU or less than about 1792 MB of memory no longer falls back to Serial GC.

## Concurrency: virtual threads and JEP 491

Before JDK 24, a virtual thread that blocked inside a `synchronized` block *pinned* its carrier thread.
[JEP 491](https://openjdk.org/jeps/491) changed the monitor implementation so the virtual thread unmounts instead. This
is exactly the kind of change a benchmark should show, provided the benchmark doesn't optimize the effect away:

```java
@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MILLISECONDS)
@Warmup(iterations = 3)
@Measurement(iterations = 5)
@Fork(3)
public class PinningBench {

    @Param({"1000", "10000"})
    int tasks;

    Object[] locks;

    @Setup(Level.Trial)
    public void setUp() {
        locks = new Object[tasks];
        for (int i = 0; i < tasks; i++) {
            locks[i] = new Object();   // escapes via the array: the JIT can't elide the lock
        }
    }

    @Benchmark
    public void blockInsideSynchronized() {
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            for (int i = 0; i < tasks; i++) {
                final Object lock = locks[i];
                executor.submit(() -> {
                    synchronized (lock) {
                        Thread.sleep(1);   // blocking while holding a monitor
                    }
                    return null;
                });
            }
        } // close() waits for all tasks
    }
}
```

Two details matter here. First, every task gets its *own* lock. A single shared lock would serialize the tasks and
measure contention, not pinning. Second, the locks are created in `@Setup` and stored in an array. If you wrote
`synchronized (new Object())`, escape analysis could prove the monitor is thread-local and remove it, and the
benchmark would show "no pinning" on JDK 21 for the wrong reason.

Run the same jar with `-jvm` pointing at a JDK 21 and a JDK 25 install. On 21, throughput is limited by the number of
carrier threads (by default, the number of available processors). On 24 and later, the sleeps overlap. Then check the
JDK 21 run with JFR's `jdk.VirtualThreadPinned` event to confirm the mechanism, rather than inferring it from the
score.

## Memory: compact object headers

[JEP 450](https://openjdk.org/jeps/450) (experimental, JDK 24), [JEP 519](https://openjdk.org/jeps/519) (product,
JDK 25) and [JEP 534](https://openjdk.org/jeps/534) (default, JDK 27) reduce the HotSpot object header from 96 to 64
bits on 64-bit platforms. For code that allocates many small objects, that is a footprint and cache-locality change.
`-prof gc` lets you measure it directly:

```java
@State(Scope.Thread)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
@Fork(3)
public class FootprintBench {

    record Point(int x, int y) {}

    @Param({"1000"})
    int n;

    @Benchmark
    public Point[] allocatePoints() {
        Point[] points = new Point[n];
        for (int i = 0; i < n; i++) {
            points[i] = new Point(i, -i);
        }
        return points;   // escapes: allocations can't be scalar-replaced
    }
}
```

```bash
# JDK 25: opt in. JDK 27: it's the default, so compare against the opt-out instead.
java -jar target/benchmarks.jar FootprintBench -prof gc -jvmArgsAppend '-XX:+UseCompactObjectHeaders'
java -jar target/benchmarks.jar FootprintBench -prof gc -jvmArgsAppend '-XX:-UseCompactObjectHeaders'
```

Compare `gc.alloc.rate.norm` between the two runs. Some arithmetic on a typical layout shows what to expect: a
two-`int` record takes a 12-byte header plus 8 bytes of fields, rounded up to 24 bytes with 8-byte alignment. With an
8-byte header it fits in 16. Check the layout with [JOL](https://github.com/openjdk/jol) rather than trusting the
arithmetic. Then look at the time score separately: a smaller footprint can make code faster, but the two numbers can
move independently.

## Warmup and startup: what steady state hides

JMH's default modes measure **steady state**: they throw away warmup on purpose. The AOT work in recent JDKs targets
exactly the part JMH discards:

- [JEP 483](https://openjdk.org/jeps/483) (JDK 24) records the classes loaded and linked during a training run, and
  later runs load them from an AOT cache.
- [JEP 514](https://openjdk.org/jeps/514) (JDK 25) reduces this to one step: `-XX:AOTCacheOutput=app.aot`.
- [JEP 515](https://openjdk.org/jeps/515) (JDK 25) stores method profiles in the cache, so the JIT can compile hot
  methods sooner.

A JMH `Throughput` score won't change with an AOT cache, and that's expected: by the time JMH starts measuring, the
JIT has already compiled the hot code. To see the effect, measure differently:

```java
@BenchmarkMode(Mode.SingleShotTime)
@Warmup(iterations = 0)
@Measurement(iterations = 1)
@Fork(value = 20)                 // many cold JVMs, one call each
@State(Scope.Benchmark)
public class ColdStartBench {

    @Benchmark
    public Object firstRequest() {
        return MyApp.handle(sampleRequest());   // first-call path: class loading, interpreter, C1
    }
}
```

`SingleShotTime` with many forks gives you the distribution of cold first calls. It still doesn't include JVM boot
time or the harness's own startup. For "time until the service answers", measure the whole process instead: run
`java -XX:AOTCache=app.aot -jar app.jar` against a run without the cache, many times, with an external tool. Report
both numbers, and say which one you're showing.

<div class="callout axiom" data-label="Principle · Name your regime">

Every benchmark measures one regime: cold start, warmup curve, steady-state throughput, tail latency, or allocation
footprint. AOT caches improve the first two, the Vector API targets the third, and compact headers affect the fifth.
A result without its regime is not a result.

</div>

## Vector API, lazy constants, and JFR

### SIMD against scalar

The Vector API is still incubating. It is in its 12th round as [JEP 537](https://openjdk.org/jeps/537) in JDK 27 and
will stay in incubation until Project Valhalla features are available as previews. It is also the API where careless
benchmarks are most misleading:

```java
@State(Scope.Thread)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.NANOSECONDS)
@Fork(value = 3, jvmArgsAppend = {"--add-modules", "jdk.incubator.vector"})
public class DotProductBench {

    static final VectorSpecies<Float> SPECIES = FloatVector.SPECIES_PREFERRED;

    @Param({"64", "1024", "65536"})
    int size;

    float[] a, b;

    @Setup(Level.Trial)
    public void setUp() {
        var rnd = new Random(42);
        a = new float[size];
        b = new float[size];
        for (int i = 0; i < size; i++) {
            a[i] = rnd.nextFloat();
            b[i] = rnd.nextFloat();
        }
    }

    @Benchmark
    public float scalar() {
        float sum = 0f;
        for (int i = 0; i < a.length; i++) {
            sum += a[i] * b[i];
        }
        return sum;
    }

    @Benchmark
    public float vector() {
        var acc = FloatVector.zero(SPECIES);
        int i = 0;
        int upper = SPECIES.loopBound(a.length);
        for (; i < upper; i += SPECIES.length()) {
            var va = FloatVector.fromArray(SPECIES, a, i);
            var vb = FloatVector.fromArray(SPECIES, b, i);
            acc = va.fma(vb, acc);
        }
        float sum = acc.reduceLanes(VectorOperators.ADD);
        for (; i < a.length; i++) {
            sum += a[i] * b[i];   // tail
        }
        return sum;
    }
}
```

The imports come from `jdk.incubator.vector`, and the compiler also needs `--add-modules jdk.incubator.vector`.
Before trusting the scores, check three things:

1. **Are the computations the same?** Floating-point addition isn't associative. The vector version sums in a
   different order and uses FMA, so its results differ slightly. That different ordering is also why C2 won't
   auto-vectorize the scalar float reduction. You are partly comparing "reordering allowed" with "reordering
   forbidden". Assert equality within a tolerance in a unit test.
2. **Is the data in cache?** At 64 elements you measure loop overhead; at 65,536 you may be measuring memory bandwidth.
   The `@Param` sweep is what turns a single number into an explanation.
3. **What does the hardware support?** `SPECIES_PREFERRED` depends on the CPU. Report the vector width with the
   result, and use `-prof perfasm` to confirm that vector instructions were actually emitted.

### Lazy constants and constant folding

[JEP 502](https://openjdk.org/jeps/502) (Stable Values, preview in JDK 25), renamed by
[JEP 526](https://openjdk.org/jeps/526) and continued in [JEP 531](https://openjdk.org/jeps/531) as
`java.lang.LazyConstant`, gives application code the JDK-internal `@Stable` behavior: a value is computed at most once,
and after that the JVM may treat it as a constant. JEP 531 says it explicitly: *to be eligible for constant folding, a
lazy constant must be stored in a final field.*

This is the constant-folding trap from earlier, now as an official API, which affects benchmarks in two ways:

```java
// Requires --enable-preview at compile time and in @Fork(jvmArgsAppend = "--enable-preview")
@State(Scope.Thread)
public class LazyConstantBench {

    static final LazyConstant<Pattern> FOLDABLE =
            LazyConstant.of(() -> Pattern.compile("[a-z]+-\\d+"));

    LazyConstant<Pattern> notFoldable =                  // non-final: ordinary field load + checks
            LazyConstant.of(() -> Pattern.compile("[a-z]+-\\d+"));

    String input = "order-42";

    @Benchmark
    public boolean staticFinal() {
        return FOLDABLE.get().matcher(input).matches();
    }

    @Benchmark
    public boolean instanceField() {
        return notFoldable.get().matcher(input).matches();
    }
}
```

When you measure `LazyConstant` itself, the `static final` case shows what production code gets with the same field
shape. When you measure something else, don't let your inputs come from lazy constants in `final` fields, or the JIT
may fold the work you meant to time. The input string in the example stays in a plain, non-`final` state field for
this reason.

### Seeing inside with JFR

Two JDK 25 JEPs make JFR more useful alongside JMH. [JEP 518](https://openjdk.org/jeps/518) changes the execution
sampler to cooperative sampling: samples are taken asynchronously, and stack traces are built at the next safepoint.
[JEP 520](https://openjdk.org/jeps/520) adds `jdk.MethodTiming` and `jdk.MethodTrace` events, which instrument
selected methods by bytecode rewriting:

```bash
java -jar target/benchmarks.jar 'JoinBench.stringJoin' -f 1 \
  -jvmArgsAppend '-XX:StartFlightRecording:method-timing=java.lang.String::join,filename=join.jfr'

jfr view method-timing join.jfr
```

Method timing is instrumentation, so it adds overhead to the method it times. Use it in a separate diagnostic fork to
answer "how often and how long?", and never in the run whose score you publish.

## A checklist before you publish a number

<div class="callout theorem" data-label="Checklist · Trustworthy microbenchmarks">

1. JMH, not `nanoTime`, with `@Fork` ≥ 2 and enough warmup to reach steady state.
2. Every result returned or passed to a `Blackhole`. Inputs in non-`final` `@State` fields.
3. No hand-written loops around the operation under test. Sizes go in `@Param`.
4. JDK version, GC, heap size, and any `-XX` flags pinned in `@Fork(jvmArgsAppend = …)` and recorded with the result.
5. `-prof gc` on every run. Allocation per operation is cheap to collect and often explains the score.
6. `-prof perfasm` or async-profiler before you claim *why* something is faster.
7. Quiet machine: no frequency scaling surprises, no IDE indexing in the background, same power profile for both runs.
8. Regime stated: steady-state throughput, single-shot cold start, or latency distribution.
9. Error bars reported. Overlapping intervals mean "no demonstrated difference".

</div>

Shipilёv's guidance has held up for a decade: a benchmark is an experiment, and the number is only valid together with
the explanation of why you got it. JMH handles the mechanics, but you still have to state the hypothesis, control the
JVM flags, and check the result with a profiler. With features like JEP 491, JEP 519/534, JEP 515 and lazy constants,
the same jar can produce different numbers on different JDKs, so recording the JDK version and flags with each result
is part of the measurement.
