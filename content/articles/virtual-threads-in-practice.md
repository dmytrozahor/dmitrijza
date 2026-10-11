---
title: 'Virtual threads in practice: what changes for backend code'
description: 'Java virtual threads make thread-per-request cheap again. Here is how to adopt them, what pinning is, and the habits you should drop.'
date: 2026-10-05
category: programming
illustration: network
tags: [java, concurrency, jvm]
---

Virtual threads became final in **Java 21** ([JEP 444](https://openjdk.org/jeps/444)). They are lightweight threads
scheduled by the JVM rather than the operating system. You can have millions of them. When one blocks on I/O, the JVM
unmounts it from its carrier thread and runs something else.

The promise: write simple, blocking, thread-per-request code and still get the scalability of async frameworks.

## Getting started

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    List<Future<Response>> futures = urls.stream()
            .map(url -> executor.submit(() -> httpClient.send(request(url), ofString())))
            .toList();
    for (var f : futures) {
        handle(f.get());
    }
} // close() waits for all tasks
```

Or start one directly:

```java
Thread.ofVirtual().name("importer-", 0).start(this::importBatch);
```

In Spring Boot 3.2+ a single property moves request handling (Tomcat/Jetty), `@Async` and scheduled tasks onto virtual
threads:

```properties
spring.threads.virtual.enabled=true
```

## Habits to drop

**Don't pool virtual threads.** Pools exist because platform threads are expensive. Virtual threads are not, so create
one per task and let it die.

**Don't use thread pools to limit concurrency.** If a downstream service can only handle 20 parallel calls, say so
explicitly:

```java
private final Semaphore permits = new Semaphore(20);

Response call(Request r) throws InterruptedException {
    permits.acquire();
    try {
        return client.send(r);
    } finally {
        permits.release();
    }
}
```

**Be careful with `ThreadLocal` caches.** A pattern like "one expensive `SimpleDateFormat` per thread" assumed a few
hundred long-lived threads. With a million short-lived virtual threads, it becomes a million short-lived objects.
Prefer immutable, shareable alternatives such as `DateTimeFormatter`. For passing context, look at `ScopedValue`.

## Pinning

A virtual thread is **pinned** when it can't unmount from its carrier while blocked, so it blocks an OS thread after
all. Historically the main culprit was blocking inside a `synchronized` block.

Since **Java 24** ([JEP 491](https://openjdk.org/jeps/491)), `synchronized` no longer pins. Virtual threads can now
acquire, hold and release monitors independently of their carrier. If you can run on 24 or newer, the long-standing
advice to replace every `synchronized` with `ReentrantLock` mostly goes away.

What still pins:

- blocking while inside **native code** (JNI) or a foreign function call,
- some class-loading and static-initializer paths.

To find pinning in production, use the JFR event `jdk.VirtualThreadPinned`, which is enabled by default with a 20 ms
threshold:

```bash
jcmd <pid> JFR.start name=pinning duration=60s filename=pinning.jfr
jfr print --events jdk.VirtualThreadPinned pinning.jfr
```

## What virtual threads don't fix

- **CPU-bound work.** Virtual threads help when you *wait*, not when you *compute*. Parallel number crunching still
  belongs in a sized pool or a parallel stream.
- **Downstream limits.** Ten thousand concurrent requests will happily exhaust a database pool of 50 connections. The
  bottleneck moves; it doesn't disappear.
- **Reactive pipelines that already work.** If you rely on backpressure and streaming operators, Reactor or similar is
  still a great fit. Virtual threads mostly win on simplicity for request/response code.

## A migration path

1. Upgrade to a recent LTS. Java 25 includes the JEP 491 pinning fix.
2. Enable virtual threads for one service and load-test it.
3. Watch the JFR pinning events and connection-pool metrics.
4. Replace pool-as-limiter patterns with semaphores and remove `ThreadLocal` caches.
5. Simplify. Code that was made asynchronous only for scalability can often become plain sequential code again.

Thread-per-request was always the easiest model to read, debug and profile. Virtual threads make it affordable again.
