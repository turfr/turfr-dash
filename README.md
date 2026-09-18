# turfr-dash

Turfr Dash is the dashboard and primary visibility layer for Turfr.

Its purpose is to provide a clear, compressed view of the data recorded by the Turfr system, making matches, player participation, contributions, payments, and outstanding balances easy to understand.

## Role in the Turfr System

Turfr is composed of separate components with distinct responsibilities:

- **turfr-cli** — ingests and helps resolve match data from canonical observations
- **turfr-api** — stores, exposes, and manages Turfr's domain data
- **turfr-dash** — presents the recorded data through a clear and transparent dashboard

The dashboard does not own the source of truth.

Turfr's recorded domain data remains the source of truth, while Turfr Dash focuses on making that information understandable and accessible.

## First Useful Version

The first version of Turfr Dash provides a shared view of the system.

It is not initially designed as a personalised player portal.

The dashboard should make it possible to understand:

- recorded matches
- participants
- contributions
- payments
- outstanding amounts
- pooled or community contributions

Where useful, derived values should remain traceable back to the recorded match data that produced them.

## Scope

The dashboard should prioritise:
- clarity
- transparency
- low operational complexity
- efficient use of API and database resources
- historical information that remains understandable without unnecessary navigation

More advanced capabilities, such as individual player accounts, personalised views, authentication through WhatsApp-linked phone numbers, and coordination workflows are future concerns.

## Status

Early project definition.

The repository currently exists to establish the dashboard's role and scope before implementation begins.