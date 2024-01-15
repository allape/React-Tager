/// <reference types="vite/client" />

declare const BOXER_VERSION: string;

declare interface ILabeledValue<T extends string | number = string> {
  label: React.ReactNode;
  value: T;
}
