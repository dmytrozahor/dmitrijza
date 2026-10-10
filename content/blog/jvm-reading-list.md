---
title: 'My JVM reading list'
description: 'Books and resources that helped me understand what actually happens when Java code runs.'
date: 2026-10-08
tags: [java, jvm, books]
---

People regularly ask where to start if they want to go deeper than the Java language. These are the resources I keep
coming back to.

## Books

- **Java Concurrency in Practice**, Brian Goetz et al. Still the best explanation of the Java Memory Model and of
  safe publication. Some APIs have moved on; the reasoning hasn't.
- **Optimizing Java**, Benjamin J. Evans, James Gough and Chris Newland. JIT compilation, GC and performance
  methodology, with a healthy suspicion of micro-benchmarks.
- **Java Performance**, Scott Oaks. A practical tour of tuning the JVM and the tools to measure it.

## Online

- **[The JVM Specification](https://docs.oracle.com/javase/specs/)**. Dry, but chapters 2, 4 and 6 (structure, class
  file format, instruction set) are essential if you touch bytecode.
- **[JVM Anatomy Quarks](https://shipilev.net/jvm/anatomy-quarks/)** by Aleksey Shipilëv. Short, precise deep-dives
  into individual JVM behaviours.
- **[OpenJDK JEPs](https://openjdk.org/jeps/0)**. The best way to understand *why* a feature looks the way it does.
- **[ASM user guide](https://asm.ow2.io/developer-guide.html)**. The starting point for bytecode manipulation (see my
  [article on ASM](../../articles/jvm-bytecode-instrumentation-with-asm/)).

## Tools worth learning

- `javap -c -v` to read bytecode,
- JDK Flight Recorder and JDK Mission Control,
- async-profiler for flame graphs,
- JMH for benchmarks you can trust.

Got a favourite I missed? Open a discussion. The button is right below.
