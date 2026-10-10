---
title: 'Share consumers in Kafka: queues without giving up the log'
description: 'Share groups (KIP-932) let many consumers read the same partition and acknowledge records one by one. How they work, how they differ from consumer groups, and how to use KafkaShareConsumer from Java.'
date: 2026-10-11
category: programming
tags: [kafka, java, messaging, distributed systems]
---

For most of its history, Kafka had one answer to "how do I scale consumption?": **add partitions**. A consumer group
assigns each partition to exactly one consumer, so a topic with 12 partitions can be processed by at most 12 consumers
in parallel. The 13th one sits idle.

That model is perfect for event streaming, where order within a partition matters. It's awkward for something people
have always wanted to do with Kafka anyway: **work queues**. Jobs that take wildly different amounts of time, consumers
that should scale up and down with load, and individual messages that should be retried without blocking everything
behind them.

[KIP-932](https://cwiki.apache.org/confluence/display/KAFKA/KIP-932%3A+Queues+for+Kafka), "Queues for Kafka", adds
a second kind of group for exactly this: the **share group**, consumed with a **share consumer**.

<div class="callout history" data-label="Status">

Share groups arrived as early access in Apache Kafka 4.0 and became a preview in 4.1, with production readiness
following in later releases. Configuration names and defaults have changed between versions, so check the
documentation for the version you run.

</div>

## Consumer groups: exclusive ownership

To see what changes, recall how classic consumer groups work:

- Each partition is assigned to **exactly one** consumer in the group.
- The consumer tracks progress with a single number per partition: the **committed offset**.
- Everything before the offset is done; everything after is not.

This is simple and very efficient, but it has consequences:

- **Parallelism is capped by the partition count.** Scaling past it means repartitioning, which changes key-to-partition
  mapping and is painful in production.
- **Head-of-line blocking.** One slow or poison record stops the whole partition, because the offset can't move past
  it.
- **No per-record retries.** You either commit past a failed record or stop. Retry topics and dead-letter topics are
  things you build yourself.

## Share groups: cooperative consumption

A share group drops the exclusive assignment. **Several consumers can fetch from the same partition at the same
time.** The broker hands out individual records, keeps track of each one, and expects each consumer to acknowledge them
one by one.

<div class="callout definition" data-label="Definition · Share group">

A **share group** is a set of consumers that cooperatively consume records from a set of topics. Records from a
partition can be delivered to any member of the group. Each record is delivered to one consumer at a time, under a
time-limited **acquisition lock**, and its fate is decided by that consumer's **acknowledgement**.

</div>

The result behaves like a queue: add consumers and throughput goes up, regardless of how many partitions the topic has.
And the topic is still an ordinary Kafka topic. Other applications can read it with normal consumer groups, replay it,
or process it with Kafka Streams.

## How the broker keeps track

For each partition a share group reads, the broker maintains a **share-partition**. Instead of one committed offset, it
tracks a window of in-flight records:

```text
                  share-partition start offset (SPSO)       share-partition end offset (SPEO)
                                 │                                        │
   ... ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ ✓ │ ✓ ⧗ ✓ ⧗ ⧗ ○ ✓ ⧗ ○ ⧗ ⧗ ✓ ⧗ ○ ⧗ ⧗ ⧗ │ · · · · · · ·
   ─────── done ──────────────────┴─────────── in-flight window ──────────┴── not yet fetched ──

   ✓ acknowledged / archived    ⧗ acquired by some consumer    ○ available (to deliver again)
```

Every record in the window is in one of four states:

| State            | Meaning                                                                          |
| ---------------- | -------------------------------------------------------------------------------- |
| **Available**    | Can be delivered to a consumer.                                                  |
| **Acquired**     | Delivered to one consumer and locked for it, until acknowledged or the lock expires. |
| **Acknowledged** | Processed successfully. Done.                                                    |
| **Archived**     | Will never be delivered again: rejected, or out of delivery attempts.            |

When the records at the start of the window are all finished, the start offset moves forward. The window's size is
bounded, so a stuck record can't make the broker track an unlimited number of records.

The state of each share-partition is managed by a **share coordinator** and persisted in an internal topic,
`__share_group_state`, so it survives broker restarts.

### The life of a record

<ol class="timeline">
  <li><strong>Available</strong> The record is inside the window and waiting.</li>
  <li><strong>Acquired</strong> A consumer's fetch returns it. Its delivery count goes up by one, and an acquisition lock starts (30 seconds by default).</li>
  <li><strong>Acknowledged</strong> The consumer reports success. This is the normal path.</li>
  <li><strong>Available again</strong> The consumer releases it, or the lock expires because the consumer crashed or was too slow. Another consumer can pick it up.</li>
  <li><strong>Archived</strong> The consumer rejects it as unprocessable, or it reached the maximum number of delivery attempts (5 by default).</li>
</ol>

The delivery limit is what makes poison messages manageable: a record that crashes its consumer every time is
eventually archived instead of blocking the partition forever.

## Acknowledgement types

A consumer decides the outcome of each record with one of three acknowledgement types:

<div class="callout axiom" data-label="AcknowledgeType">

- **`ACCEPT`**: processed successfully. The record becomes _acknowledged_.
- **`RELEASE`**: not processed, but give it to someone else. The record becomes _available_ again. The attempt still
  counts towards the delivery limit.
- **`REJECT`**: can never be processed. The record is _archived_ immediately.

</div>

There are two acknowledgement modes:

- **Implicit** (the default): every record returned by `poll` is accepted automatically on the next `poll`,
  `commitSync` or `commitAsync`. This is the simplest option, and fine when failures are rare and you just throw.
- **Explicit**: you call `acknowledge` for every record yourself. Recent clients enable this with
  `share.acknowledgement.mode=explicit`.

## Using KafkaShareConsumer from Java

The client API is deliberately close to `KafkaConsumer`. Here is a worker with explicit acknowledgements:

```java
Properties props = new Properties();
props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
props.put(ConsumerConfig.GROUP_ID_CONFIG, "invoice-workers");
props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
props.put("share.acknowledgement.mode", "explicit");

try (var consumer = new KafkaShareConsumer<String, String>(props)) {
    consumer.subscribe(List.of("invoice-jobs"));

    while (running) {
        ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));

        for (ConsumerRecord<String, String> record : records) {
            try {
                invoices.render(record.value());
                consumer.acknowledge(record, AcknowledgeType.ACCEPT);
            } catch (InvalidInvoiceException e) {
                consumer.acknowledge(record, AcknowledgeType.REJECT);   // never retry
            } catch (TemporaryFailureException e) {
                consumer.acknowledge(record, AcknowledgeType.RELEASE);  // let another worker try
            }
        }

        consumer.commitSync();   // send the acknowledgements to the broker
    }
}
```

Note what's missing: no partition assignment, no rebalance listener, no offsets. Scaling the worker pool means
starting more instances of this program.

> **Watch the lock duration.** If processing a record can take longer than the acquisition lock, the record becomes
> available again while you're still working on it, and another consumer will process it too. Keep work per record well
> under the lock duration, or raise the lock duration on the broker.

### Starting position

A new share group starts reading at the **latest** offset by default. To process records that are already in the
topic, set the group's `share.auto.offset.reset` to `earliest`. It's a group configuration, not a client one:

```bash
kafka-configs.sh --bootstrap-server localhost:9092 \
  --entity-type groups --entity-name invoice-workers \
  --alter --add-config share.auto.offset.reset=earliest
```

To inspect a group, including its members and the start offset per partition, use `kafka-share-groups.sh --describe`.

## Consumer groups vs share groups

| Aspect               | Consumer group                       | Share group                                  |
| -------------------- | ------------------------------------ | -------------------------------------------- |
| Partition ownership  | Exclusive: one consumer per partition | Shared: many consumers per partition        |
| Max parallelism      | Number of partitions                 | Number of consumers                          |
| Progress tracking    | One committed offset per partition   | State per in-flight record                   |
| Ordering             | Guaranteed within a partition        | **No ordering guarantee**                    |
| Failed records       | Block the partition or are skipped   | Released, retried, archived after N attempts |
| Delivery semantics   | At-least-once (exactly-once with transactions) | At-least-once                      |
| Typical use          | Event streams, state, ordered processing | Work queues, jobs, independent tasks     |

## When to use which

<div class="callout theorem" data-label="Rule of thumb">

Use a **consumer group** when the _order_ of events matters, because each event changes some state that depends on
the previous ones: account balances, entity lifecycles, change-data capture, stream processing.

Use a **share group** when each record is an _independent task_: sending e-mails, rendering documents, calling an
external API, running a job. Here throughput, elasticity and per-record retries matter more than order.

</div>

Some practical consequences:

- **Make processing idempotent.** Delivery is at-least-once. Lock expiries and consumer crashes mean a record can be
  processed more than once.
- **Don't rely on keys for ordering.** Two records with the same key can be processed by different consumers at the
  same time.
- **Treat archived records as data loss unless you handle them.** Record why you reject something, for example by
  writing it to a dead-letter topic yourself before acknowledging with `REJECT`.
- **Mind the tooling.** Framework support is still catching up. Spring for Apache Kafka, for example, only recently
  added share-consumer support, so check your versions before planning a migration.

## Why this matters

Before share groups, many teams ran Kafka _and_ a message queue such as RabbitMQ or SQS, for no better reason than
the different consumption model. Share groups don't make Kafka a full replacement for every broker feature, but they
remove the most common reason for running both: you can keep events in a durable, replayable log and still consume
them as a queue.

It's a nice example of a well-designed extension. Kafka didn't change its storage model at all. The log stays exactly
as it was; only the **bookkeeping of who has processed what** moved from a single offset to a small window of
per-record state on the broker.
