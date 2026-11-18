/** Execution stages defined by the Milvus function chain protocol. */
export enum FunctionChainStage {
  UNSPECIFIED = 0,
  INGESTION = 1,
  PRE_PROCESS = 2,
  L0_RERANK = 3,
  L1_RERANK = 4,
  L2_RERANK = 5,
  POST_PROCESS = 6,
  QUERY_SCAN = 7,
}

export interface FunctionParamArray {
  values: FunctionParamValue[];
}

export interface FunctionParamObject {
  fields: Record<string, FunctionParamValue>;
}

type OneOf<Fields> = {
  [Key in keyof Fields]: Pick<Fields, Key> & {
    [Other in Exclude<keyof Fields, Key>]?: never;
  };
}[keyof Fields];

/** A protobuf oneof. Use a decimal string for int64 values beyond JS's safe integer range. */
export type FunctionParamValue = OneOf<{
  bool_value: boolean;
  int64_value: number | string;
  double_value: number;
  string_value: string;
  array_value: FunctionParamArray;
  object_value: FunctionParamObject;
  bytes_value: Uint8Array | string; // Strings use base64 encoding.
}>;

export interface FunctionChainColumnArg {
  name: string;
}

export type FunctionChainExprArg = OneOf<{
  column: FunctionChainColumnArg;
  literal: FunctionParamValue;
}>;

export interface FunctionChainExpr {
  name: string;
  args?: FunctionChainExprArg[];
  params?: Record<string, FunctionParamValue>;
}

export interface FunctionChainOp {
  op: string;
  expr?: FunctionChainExpr;
  inputs?: string[];
  outputs?: string[];
  params?: Record<string, FunctionParamValue>;
}

/** A raw function chain using the protobuf field names. */
export interface FunctionChainSpec {
  name?: string;
  stage: number;
  ops: FunctionChainOp[];
  output_columns?: string[];
}

type FunctionChainInput =
  | FunctionChainSpec
  | import('../FunctionChain').FunctionChain;

/** A single builder or spec, or an ordered array of either. */
export type FunctionChains = FunctionChainInput | readonly FunctionChainInput[];
