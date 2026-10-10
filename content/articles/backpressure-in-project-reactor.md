---
title: 'Backpressure in Project Reactor, explained with code'
description: 'What request(n) really means, how prefetch and limitRate shape demand, and how to choose an overflow strategy when a producer is faster than its consumer.'
date: 2026-09-28
category: programming
tags: [java, reactive, reactor]
---

Reactive Streams has one idea that sets it apart from "just callbacks": **the consumer controls the speed**. A
subscriber says how many elements it can handle, and a well-behaved publisher never sends more. That's backpressure.

In Project Reactor this happens mostly out of sight. Understanding it is the difference between a pipeline that stays
calm under load and one that ends with an `OutOfMemoryError` or an `OverflowException`.

## Demand is a number

The protocol is tiny:

```java
public interface Subscription {
    void request(long n); // "I can take n more"
    void cancel();
}
```

A `Subscriber` gets a `Subscription` in `onSubscribe` and calls `request(n)`. The publisher may then call `onNext` at
most *n* times. `Long.MAX_VALUE` means "unbounded, just push everything".

When you call `.subscribe(System.out::println)`, Reactor requests `Long.MAX_VALUE`. That's convenient, but it means
**no backpressure at the final subscriber**. To see real demand signalling, write your own subscriber:

```java
Flux.range(1, 10)
    .log()
    .subscribe(new BaseSubscriber<Integer>() {
        @Override
        protected void hookOnSubscribe(Subscription s) {
            request(1);
        }

        @Override
        protected void hookOnNext(Integer value) {
            process(value);
            request(1); // ask for the next one only when ready
        }
    });
```

With `.log()` you'll see `request(1)` / `onNext` alternate, so the producer is paced by the consumer.

## Operators have queues: prefetch

Operators that switch threads or merge streams, such as `publishOn`, `flatMap` and `concatMap`, keep an internal queue.
They don't forward your demand 1:1. They **prefetch** a batch from upstream and refill it as it drains.

```java
Flux.range(1, 1_000)
    .log("upstream")
    .publishOn(Schedulers.boundedElastic())   // default prefetch: 256
    .subscribe(this::slowWork);
```

In the log you'll see `request(256)` upstream, followed later by `request(192)`. By default Reactor replenishes when
75 % of the prefetched elements have been consumed. You can tune the prefetch:

```java
.publishOn(Schedulers.boundedElastic(), 32)
```

## limitRate: shaping demand explicitly

`limitRate(n)` caps the demand that goes upstream, whatever the downstream asks for. That even includes
`Long.MAX_VALUE`:

```java
repository.findAll()          // e.g. a database cursor
    .limitRate(100)           // fetch in pages of 100, refill at 75
    .map(this::toDto)
    .subscribe(sink::write);
```

This is the easiest way to turn an "unbounded" subscriber into well-sized batches against a database, a message broker
or an HTTP API that supports pagination.

## When the producer can't slow down

Some sources can't be paused: UI events, sensor data, a WebSocket you don't control. They're *hot*. For these you
have to decide what happens when demand runs out:

| Strategy                  | Behaviour                                               | Good for                       |
| ------------------------- | ------------------------------------------------------- | ------------------------------ |
| `onBackpressureBuffer(n)` | Queue up to *n* items, then error (or a custom handler) | Short bursts                   |
| `onBackpressureDrop()`    | Discard items no one asked for                          | Metrics, telemetry             |
| `onBackpressureLatest()`  | Keep only the newest item                               | Prices, positions, UI state    |
| `onBackpressureError()`   | Fail fast with `OverflowException`                      | When loss is never acceptable  |

```java
priceTicks()                                  // hot, can't slow down
    .onBackpressureLatest()                   // a stale price is useless anyway
    .publishOn(Schedulers.parallel(), 1)
    .subscribe(this::render);
```

When you bridge callback APIs with `Flux.create`, you choose the strategy up front:

```java
Flux.<Event>create(sink -> listener.onEvent(sink::next), FluxSink.OverflowStrategy.DROP);
```

`Flux.create` defaults to `BUFFER`, which is unbounded. It's a common source of memory leaks when the consumer is
slower than expected.

## Practical checklist

- **Know where your unbounded requests are.** `subscribe(consumer)`, `block*()` and `collectList()` all request
  everything.
- **Bound concurrency in `flatMap`.** `flatMap(fn, 8)` limits how many inner publishers run at once. That's
  backpressure on *work*, not just elements.
- **Pick an overflow strategy on purpose** for every hot source and every `Flux.create`.
- **Use `.log()` while developing.** Watching `request(n)` lines is the fastest way to understand a pipeline.

Backpressure isn't something you add at the end. It's a property of every link in the chain, and Reactor gives you a
knob for each of them.
