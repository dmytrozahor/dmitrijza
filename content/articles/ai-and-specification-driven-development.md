---
title: 'Writing the intent, not the code: AI and specification-driven development'
description: 'AI assistants are changing what a developer’s day consists of. Why adapting early matters, where the tools fail, and why the specification is becoming the most important artifact we write.'
date: 2026-10-11
category: personal
tags: [ai, software engineering, specification, career]
---

Every generation of developers has had its "this changes everything" moment. Compilers took assembly away from most
of us. Garbage collectors took away manual memory management. IDEs with refactoring support made renaming a class across
a thousand files a single keystroke. Each time, some people saw a threat and others saw leverage. In hindsight, the
leverage side was always right.

AI assistants are the current moment, and they differ in one important way: they don't automate a _step_ of our work,
they automate a large part of the _typing_. That forces a question older tools never asked: **if writing the code is
cheap, what is the job?**

<blockquote class="pull">
When code becomes cheap, clarity becomes expensive.
</blockquote>

## Adapting is not optional

It is tempting to treat AI as a fad, or as something for juniors, or as a risk to be contained. I think all three are
mistakes, for a simple reason: **the cost curve has moved**. Producing a first draft of a feature, a migration, a test
suite or an unfamiliar API integration now takes minutes instead of hours. Teams that learn to use this well will
iterate faster, explore more alternatives and spend more time on the parts that need human judgment.

Adapting doesn't mean handing over the keyboard. It means moving up a level:

<div class="callout definition" data-label="Principle · The shifting role">

The developer's value moves from **producing code** to **deciding what the code must do**, **shaping how it fits the
system**, and **verifying that it does it**. Typing becomes delegation; reviewing becomes the core skill.

</div>

In practice, using AI more often at work looks unglamorous:

- **Exploration.** Ask for three different designs before committing to one. Throwing away a draft costs nothing.
- **The boring 80 %.** Mappers, DTOs, test fixtures, migration scripts, boilerplate configuration.
- **Unfamiliar territory.** A library you haven't used, a protocol you half-remember, a legacy module nobody owns.
- **Review and explanation.** "What does this regex do?", "Where could this race?", "Summarise this 600-line diff."
- **Tests first.** Generating test cases from requirements often surfaces edge cases you hadn't written down.

None of this replaces engineering. It removes friction around it.

## Where it goes wrong

The failure mode is well known by now, and it has a name: **vibe coding**. You describe what you want in a chat, accept
whatever appears, and repeat until it seems to work. For a throwaway prototype, that's fine. For a production system,
it fails in predictable ways.

<div class="callout history" data-label="Anti-pattern · Intent lost in chat">

- **The intent evaporates.** The real requirements live in a conversation history that nobody will read again. The
  code is the only artifact left, and code says _what_ it does, never _why_.
- **Plausible is not correct.** Generated code is fluent by construction. It compiles, it looks idiomatic, and it can
  still encode a misunderstanding of the domain.
- **Review fatigue.** Reading large amounts of code you didn't design is harder than writing it. Bugs hide in the parts
  that "look fine".
- **No ground truth.** When the next change comes, there is nothing to check the new behaviour against.

</div>

The root problem isn't the model. It's that we are giving it **ambiguous input**. An AI assistant is an extremely fast
executor of intent, and it executes ambiguity just as fast as clarity.

## Specification-driven development

Specification-driven development (SDD) flips the relationship between intent and code. **The specification is the
source of truth, and code is a derived artifact.** You put your effort into stating precisely what the system must do;
generating and regenerating the implementation becomes the cheap part.

The workflow has a recognisable shape. Tools like GitHub's Spec Kit and AWS's Kiro IDE organise it in similar phases:

<ol class="timeline">
  <li><strong>Specify</strong> What and why: user-visible behaviour, acceptance criteria, constraints, non-goals. No technology choices yet.</li>
  <li><strong>Plan</strong> How: architecture, data model, interfaces, the libraries and patterns of <em>this</em> codebase.</li>
  <li><strong>Tasks</strong> Break the plan into small, independently verifiable steps.</li>
  <li><strong>Implement</strong> Let the assistant execute the tasks, one reviewable change at a time.</li>
  <li><strong>Verify</strong> Tests derived from the acceptance criteria decide whether it's done, not the feeling that it looks right.</li>
</ol>

Each phase produces a file that lives in the repository, next to the code, and goes through code review like code
does.

### What a good spec looks like

Here is a small, hypothetical example: importing meter readings from a CSV upload. The requirements use the
**EARS** pattern (_Easy Approach to Requirements Syntax_), a lightweight way of writing requirements that are hard to
misread:

```markdown
# Feature: Meter reading import

## Context

Operators upload monthly CSV files with readings from field devices.
Today this is done by hand, which is slow and error-prone.

## Requirements

1. WHEN a CSV file is uploaded, THE SYSTEM SHALL validate every row
   before importing any of them.
2. IF any row is invalid, THEN THE SYSTEM SHALL reject the whole file
   and report every invalid row with its line number and reason.
3. WHEN a reading for the same meter and timestamp already exists,
   THE SYSTEM SHALL keep the existing value and report the row as a duplicate.
4. THE SYSTEM SHALL process a file of 100 000 rows in under 30 seconds.

## Acceptance criteria

- Given a file with 3 valid rows, when it is uploaded, then 3 readings are stored.
- Given a file where row 7 has a negative value, when it is uploaded, then nothing is stored
  and the report contains "line 7: value must be ≥ 0".

## Non-goals

- No support for Excel files.
- No correction of invalid rows in the UI.
```

Three things make this spec useful, for humans and for an AI:

- **It is testable.** Every requirement can be turned into a check. Requirement 2 alone rules out a whole class of
  "import what you can" implementations a model might otherwise choose.
- **It states non-goals.** Assistants are eager. Without explicit boundaries, they helpfully add features nobody asked
  for, and every extra line is something to review and maintain.
- **It contains no implementation.** The plan decides between a batch insert and a streaming parser. The spec only
  says what must be true, so it survives refactoring and technology changes.

### From criteria to tests

Acceptance criteria translate almost mechanically into tests, which gives the generated implementation a target it
can't argue with:

```java
@Test
void rejectsWholeFileAndReportsLineNumberWhenAValueIsNegative() {
    var file = csv(
            "meter;timestamp;value",
            validRows(5),
            "M-1001;2026-09-30T00:00;-4.2",   // line 7
            validRows(2));

    ImportReport report = importer.importReadings(file);

    assertThat(readings.count()).isZero();
    assertThat(report.errors()).containsExactly("line 7: value must be ≥ 0");
}
```

Write or review these tests **before** accepting any implementation. If the assistant has to change a test to make
it pass, that is a conversation about the spec, not about the code.

## This idea is older than AI

None of this is new in spirit. Software engineering has been reaching for executable intent for decades:

<div class="callout axiom" data-label="Lineage">

- **Design by Contract** (Bertrand Meyer, Eiffel): preconditions, postconditions and invariants as part of the code.
- **Test-driven development** (Kent Beck): the test is written first and defines "done".
- **Behaviour-driven development** (Dan North): Given / When / Then scenarios in the language of the business.
- **Contract-first APIs**: an OpenAPI document is agreed on, and servers and clients are generated from it.

</div>

What changed is the executor. These practices were often seen as overhead, because a human still had to write the
implementation _and_ the specification. When the implementation becomes cheap, the specification is no longer
overhead. **It is the work.**

## Practical habits for teams

<div class="callout theorem" data-label="Checklist · Making it work day to day">

1. **Keep specs in the repository**, versioned and reviewed like code. A spec that lives in a wiki drifts on the first
   day.
2. **Write project context down once**: conventions, architecture, "how we do things here". Most assistants can read a
   context file on every task, which is far cheaper than repeating yourself in every prompt.
3. **Keep specs small.** One feature, one spec. Large specs produce large diffs, and large diffs don't get reviewed
   properly.
4. **Always include non-goals and constraints**, such as performance, security and compatibility.
5. **Derive tests from acceptance criteria first**, then implement.
6. **Change the spec first, then the code.** When behaviour changes, the spec changes in the same pull request.
7. **Own the result.** "The AI wrote it" is not an explanation in an incident review. You merged it, so you
   understand it.

</div>

## The risks worth taking seriously

Specification-driven development has its own failure modes:

- **Waterfall in disguise.** A spec isn't a contract signed in blood. Keep the loop short: specify a slice, build it,
  learn, revise.
- **Over-specification.** If the spec dictates every class name, you've written the code in English. Specify behaviour;
  leave design to the plan.
- **Spec drift.** A spec that disagrees with the code is worse than no spec. Treat drift like a failing test.
- **Skill atrophy.** If you never write code, you lose the intuition that makes reviewing possible. Keep writing the
  hard parts yourself.

## Closing thought

There's a nice symmetry here with the history of mathematics. Mathematicians spent the early twentieth century learning
to state precisely what they meant, because informal reasoning had led them into paradoxes. Software engineering is
having a similar moment: an extremely capable executor forces us to say what we mean, because it will faithfully
build whatever we _actually_ said.

The developers who do well in the coming years won't be the ones who type fastest, and probably not the ones who
prompt most cleverly either. They will be the ones who can **state intent clearly, decompose problems well, and verify
results rigorously**. That has always been the core of the craft. AI just removed the parts that let us forget it.
