# Multi-JSON-to-TS

[![Tests](https://github.com/strenkml/multi-json-to-ts/actions/workflows/test.yml/badge.svg?branch=master)](https://github.com/strenkml/multi-json-to-ts/actions/workflows/test.yml) [![Linter](https://github.com/strenkml/multi-json-to-ts/actions/workflows/linter.yml/badge.svg?branch=master)](https://github.com/strenkml/multi-json-to-ts/actions/workflows/linter.yml)

Takes multiple similar JSON objects, checks for structural differences and create TS interfaces. Useful for creating interfaces for the output of APIs that you don't know the structure of.

## Installation

```bash
npm install multi-json-to-ts
```

## Usage

```typescript
import InterfaceGenerator from "multi-json-to-ts";

const variation1 = {
  name: "John",
  age: 30,
  birthplace: {
    city: "New York",
    state: "NY",
  },
  stats: [{ year: 2020, goals: 10 }],
};

const variation2 = {
  name: "Sarah",
  age: 20,
  birthplace: {
    city: "Toronto",
    country: "Canada",
  },
  stats: [{ year: 2020, assists: 5 }],
};

const interfaceGenerator = new InterfaceGenerator("IPerson", "./output", true);
// or const interfaceGenerator = new InterfaceGenerator("IPerson", "./output", true, [variation1, variation2]);

interfaceGenerator.addJsonVariation(variation1);
interfaceGenerator.addJsonVariation(variation2);

interfaceGenerator.generateInterfaces();
```

This will generate the following TypeScript interfaces:

```typescript
// Generated by multi-json-to-ts

export interface IPerson_birthplace {
  city: string;
  state?: string;
  country?: string;
}

export interface IPerson_stats {
  year: number;
  goals?: number;
  assists?: number;
}

export interface IPerson {
  name: string;
  age: number;
  birthplace: IPerson_birthplace;
  stats: IPerson_stats[];
}
```
