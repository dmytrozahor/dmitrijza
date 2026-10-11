---
title: 'JVM bytecode instrumentation with ASM: timing every method without touching the source'
description: 'Build a tiny Java agent that rewrites classes at load time with ASM and records how long each method takes, and learn the pitfalls on the way.'
date: 2026-09-14
category: programming
illustration: layers
tags: [java, jvm, bytecode, asm]
---

Sometimes you need to know what a piece of code is doing, but you can't, or don't want to, change its source. Maybe
it's a third-party library. Maybe there are hundreds of methods and you don't want to sprinkle `System.nanoTime()`
everywhere. This is where **bytecode instrumentation** comes in: you rewrite the compiled classes as the JVM loads them.

In this article we'll build a minimal Java agent that measures the execution time of every method in a package, using
[ASM](https://asm.ow2.io/), the low-level bytecode library that also powers parts of the JDK, Spring and many profilers.

## The moving parts

There are three pieces:

1. **A Java agent.** It's a JAR with a `premain` method that the JVM calls before `main` when you start with
   `-javaagent:agent.jar`.
2. **A `ClassFileTransformer`.** The JVM hands it the raw bytes of every class it is about to define, and the
   transformer may return modified bytes.
3. **ASM visitors.** They parse those bytes, let us inject instructions, and write a new class file.

## The agent entry point

```java
public final class TimingAgent {

    public static void premain(String args, Instrumentation inst) {
        String prefix = (args == null ? "com/example" : args).replace('.', '/');
        inst.addTransformer(new TimingTransformer(prefix));
    }
}
```

The agent JAR's `MANIFEST.MF` has to point at this class:

```text
Premain-Class: com.example.agent.TimingAgent
```

## The transformer

```java
final class TimingTransformer implements ClassFileTransformer {

    private final String prefix;

    TimingTransformer(String prefix) {
        this.prefix = prefix;
    }

    @Override
    public byte[] transform(ClassLoader loader, String className, Class<?> redefined,
                            ProtectionDomain domain, byte[] bytes) {
        if (className == null || !className.startsWith(prefix)) {
            return null; // null means "leave this class unchanged"
        }
        ClassReader reader = new ClassReader(bytes);
        ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_FRAMES);
        reader.accept(new TimingClassVisitor(writer), ClassReader.EXPAND_FRAMES);
        return writer.toByteArray();
    }
}
```

Two flags matter here:

- `COMPUTE_FRAMES` tells ASM to recompute the stack map frames that the verifier requires since Java 7. We add
  locals and branches, so the old frames are no longer valid.
- `EXPAND_FRAMES` is required by `AdviceAdapter`, which we use below.

> **Pitfall:** `COMPUTE_FRAMES` sometimes has to find the common superclass of two types. The default implementation
> does that with `Class.forName`, which can load classes too early or fail inside a transformer. For production agents,
> override `ClassWriter.getCommonSuperClass` and resolve types from the bytes instead.

## Injecting the timing code

`AdviceAdapter` gives us two hooks: `onMethodEnter` and `onMethodExit`, which runs before every `return` *and*
`athrow`. Because it extends `GeneratorAdapter`, we also get helpers such as `newLocal` and `invokeStatic`.

```java
final class TimingClassVisitor extends ClassVisitor {

    private String owner;

    TimingClassVisitor(ClassVisitor next) {
        super(Opcodes.ASM9, next);
    }

    @Override
    public void visit(int version, int access, String name, String signature,
                      String superName, String[] interfaces) {
        this.owner = name;
        super.visit(version, access, name, signature, superName, interfaces);
    }

    @Override
    public MethodVisitor visitMethod(int access, String name, String descriptor,
                                     String signature, String[] exceptions) {
        MethodVisitor mv = super.visitMethod(access, name, descriptor, signature, exceptions);
        boolean skip = mv == null
                || (access & (Opcodes.ACC_ABSTRACT | Opcodes.ACC_NATIVE)) != 0
                || name.equals("<clinit>");
        return skip ? mv : new TimingMethodVisitor(mv, access, name, descriptor, owner);
    }
}
```

```java
final class TimingMethodVisitor extends AdviceAdapter {

    private static final Type SYSTEM = Type.getType(System.class);
    private static final Method NANO_TIME = Method.getMethod("long nanoTime()");
    private static final Type TIMINGS = Type.getObjectType("com/example/agent/Timings");
    private static final Method RECORD = new Method("record", "(JLjava/lang/String;)V");

    private final String label;
    private int start;

    TimingMethodVisitor(MethodVisitor mv, int access, String name, String descriptor, String owner) {
        super(Opcodes.ASM9, mv, access, name, descriptor);
        this.label = owner.replace('/', '.') + "#" + name;
    }

    @Override
    protected void onMethodEnter() {
        invokeStatic(SYSTEM, NANO_TIME);      // stack: long
        start = newLocal(Type.LONG_TYPE);
        storeLocal(start);                    // stack: (empty)
    }

    @Override
    protected void onMethodExit(int opcode) {
        invokeStatic(SYSTEM, NANO_TIME);      // stack: [ret], now
        loadLocal(start);                     // stack: [ret], now, start
        math(SUB, Type.LONG_TYPE);            // stack: [ret], elapsed
        push(label);                          // stack: [ret], elapsed, label
        invokeStatic(TIMINGS, RECORD);        // stack: [ret]
    }
}
```

The return value (if any) stays on the operand stack underneath our instructions, so we never have to touch it. That's
why `record` takes `(long, String)` and not `(String, long)`. Swapping a two-slot `long` under a reference costs extra
`dup2_x1`/`pop2` gymnastics.

> **Note on constructors:** `AdviceAdapter` delays `onMethodEnter` in `<init>` until after the `super(...)` call, so
> instrumenting constructors is safe. That's one of the main reasons to use it over a plain `MethodVisitor`.

## The runtime side

The injected code calls a regular Java class that ships inside the agent JAR:

```java
public final class Timings {

    private static final ConcurrentHashMap<String, LongAdder> TOTAL = new ConcurrentHashMap<>();

    static {
        Runtime.getRuntime().addShutdownHook(new Thread(Timings::dump));
    }

    public static void record(long nanos, String method) {
        TOTAL.computeIfAbsent(method, k -> new LongAdder()).add(nanos);
    }

    private static void dump() {
        TOTAL.entrySet().stream()
             .sorted(Map.Entry.<String, LongAdder>comparingByValue(
                     Comparator.comparingLong(LongAdder::sum)).reversed())
             .limit(20)
             .forEach(e -> System.out.printf("%,12d µs  %s%n", e.getValue().sum() / 1_000, e.getKey()));
    }
}
```

Because the instrumented classes will call `com.example.agent.Timings`, that class must be visible to their class
loader. The agent JAR is on the system class path, so this works for normal applications. In containers such as
application servers you may need `Boot-Class-Path` or `Instrumentation.appendToBootstrapClassLoaderSearch`.

## Running it

```bash
java -javaagent:timing-agent.jar=com.example.shop -jar shop.jar
```

On shutdown you get a ranked list of the hottest methods, without touching a single line of the application's source.

## Where to go from here

- **Exclude trivial methods** such as getters and setters. They're noise, and timing them distorts the result.
- **Track self-time** instead of inclusive time by keeping a per-thread stack.
- **Use `retransformClasses`** with `Can-Retransform-Classes: true` to attach to an already running JVM through the
  Attach API.
- Consider higher-level libraries such as **Byte Buddy** once you know what happens underneath. ASM is the right tool
  when you need full control and minimal overhead.

Bytecode can look intimidating, but the mental model is simple: a stack machine, a list of instructions, and visitors
that let you insert more of them.
