import {
  FunctionChainColumnArg,
  FunctionChainExpr,
  FunctionChainOp,
  FunctionChainSpec,
  FunctionChainStage,
  FunctionChains,
  FunctionParamValue,
} from './types/FunctionChain';

type ColumnRef = { column: FunctionChainColumnArg };
type MergeStrategy = 'rrf' | 'weighted' | 'max' | 'sum' | 'avg';
type NumCombineMode = 'multiply' | 'sum' | 'max' | 'min' | 'avg' | 'weighted';
type ParamInput =
  | boolean
  | number
  | string
  | Uint8Array
  | readonly ParamInput[]
  | { [name: string]: ParamInput };

/**
 * Reference a collection field, temporary column or system column.
 * @param name - Column name.
 * @returns A column argument for function chain expressions.
 */
export function col(name: string): ColumnRef {
  if (typeof name !== 'string' || !name) {
    throw new Error('Function chain column name must be a non-empty string');
  }
  return { column: { name } };
}

function requireColumn(value: ColumnRef): string {
  if (typeof value?.column?.name !== 'string' || !value.column.name) {
    throw new Error(
      'Function chain expressions require column arguments such as col("field")'
    );
  }
  return value.column.name;
}

function doubleValue(value: number): FunctionParamValue {
  if (!Number.isFinite(value)) {
    throw new Error('Function chain numeric parameters must be finite numbers');
  }
  return { double_value: value };
}

function weightsValue(weights: readonly number[]): FunctionParamValue {
  if (!Array.isArray(weights)) {
    throw new Error('Function chain weights must be an array of numbers');
  }
  return { array_value: { values: Array.from(weights, doubleValue) } };
}

function paramValue(value: ParamInput): FunctionParamValue {
  if (typeof value === 'boolean') return { bool_value: value };
  if (typeof value === 'string') return { string_value: value };
  if (typeof value === 'number') {
    return Number.isSafeInteger(value)
      ? { int64_value: value }
      : doubleValue(value);
  }
  if (value instanceof Uint8Array) return { bytes_value: value };
  if (Array.isArray(value)) {
    return { array_value: { values: Array.from(value, paramValue) } };
  }
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return {
      object_value: { fields: paramMap(value as Record<string, ParamInput>) },
    };
  }
  throw new Error('Unsupported function chain parameter value');
}

function paramMap(params: Record<string, ParamInput>) {
  return Object.fromEntries(
    Object.entries(params).map(([name, value]) => [name, paramValue(value)])
  );
}

/**
 * Build an ordered chain of operations for a Milvus execution stage.
 * @param stage - The stage in which Milvus executes the chain.
 * @param options - An optional chain name and QueryScan output columns.
 */
export class FunctionChain {
  private readonly ops: FunctionChainOp[] = [];
  private readonly name: string;
  private readonly outputColumns: string[];

  constructor(
    private readonly stage: FunctionChainStage,
    {
      name = '',
      outputColumns = [],
    }: { name?: string; outputColumns?: readonly string[] } = {}
  ) {
    if (typeof stage !== 'number' || FunctionChainStage[stage] === undefined) {
      throw new Error(`Unknown function chain stage: ${stage}`);
    }
    if (typeof name !== 'string') {
      throw new Error('Function chain name must be a string');
    }
    if (
      !Array.isArray(outputColumns) ||
      Array.from(outputColumns).some(
        column => typeof column !== 'string' || !column
      )
    ) {
      throw new Error('outputColumns must be an array of non-empty strings');
    }
    if (
      new Set(outputColumns).size !== outputColumns.length ||
      outputColumns.includes('_original_idx')
    ) {
      throw new Error(
        'outputColumns must be unique and cannot contain _original_idx'
      );
    }
    if (
      outputColumns.length &&
      (stage !== FunctionChainStage.QUERY_SCAN || !name)
    ) {
      throw new Error(
        'outputColumns requires a named QUERY_SCAN function chain'
      );
    }
    this.name = name;
    this.outputColumns = [...outputColumns];
  }

  /**
   * Write the result of an expression to a column.
   * @param output - Temporary or system column name.
   * @param expr - Expression to evaluate.
   * @returns This chain.
   */
  map(output: string, expr: FunctionChainExpr): this {
    if (typeof output !== 'string' || !output) {
      throw new Error('Function chain map output must be a non-empty string');
    }
    if (typeof expr?.name !== 'string' || !expr.name) {
      throw new Error('Function chain map requires a named expression');
    }
    if (expr.args?.some(arg => typeof arg === 'string')) {
      throw new Error(
        'Use col("field") or an explicit literal for function chain expression arguments'
      );
    }
    this.ops.push({ op: 'map', expr, outputs: [output] });
    return this;
  }

  /**
   * Sort by a column, optionally using a second column to break ties.
   * @param by - Primary sort column.
   * @param options - Sort direction and optional tie-break column.
   * @returns This chain.
   */
  sort(
    by: string | ColumnRef,
    {
      desc = true,
      tieBreakCol,
    }: { desc?: boolean; tieBreakCol?: string | ColumnRef } = {}
  ): this {
    const column = requireColumn(typeof by === 'string' ? col(by) : by);
    if (typeof desc !== 'boolean') {
      throw new Error('Function chain sort desc must be a boolean');
    }
    const params: Record<string, FunctionParamValue> = {
      column: { string_value: column },
      desc: { bool_value: desc },
    };
    const inputs = [column];
    if (tieBreakCol !== undefined) {
      const name = requireColumn(
        typeof tieBreakCol === 'string' ? col(tieBreakCol) : tieBreakCol
      );
      inputs.push(name);
      params.tie_break_col = { string_value: name };
    }
    this.ops.push({ op: 'sort', inputs, params });
    return this;
  }

  /**
   * Keep a page of results.
   * @param limit - Positive maximum row count.
   * @param offset - Number of rows to skip.
   * @returns This chain.
   */
  limit(limit: number, offset = 0): this {
    if (
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      !Number.isSafeInteger(offset) ||
      offset < 0
    ) {
      throw new Error(
        'Function chain limit must be a positive safe integer and offset a non-negative safe integer'
      );
    }
    this.ops.push({
      op: 'limit',
      params: {
        limit: { int64_value: limit },
        offset: { int64_value: offset },
      },
    });
    return this;
  }

  /**
   * Merge the candidate lists in hybrid search.
   * @param strategy - Fusion strategy.
   * @param options - Per-input weights, score normalization and RRF constant.
   * @returns This chain.
   */
  merge(
    strategy: MergeStrategy,
    {
      weights,
      normScore,
      k,
    }: { weights?: readonly number[]; normScore?: boolean; k?: number } = {}
  ): this {
    if (!['rrf', 'weighted', 'max', 'sum', 'avg'].includes(strategy)) {
      throw new Error(`Unsupported function chain merge strategy: ${strategy}`);
    }
    if (strategy === 'rrf') k = k ?? 60;
    else normScore = normScore ?? true;

    const params: Record<string, FunctionParamValue> = {
      strategy: { string_value: strategy },
    };
    if (weights !== undefined) params.weights = weightsValue(weights);
    if (normScore !== undefined) {
      if (typeof normScore !== 'boolean')
        throw new Error('normScore must be a boolean');
      params.norm_score = { bool_value: normScore };
    }
    if (k !== undefined) {
      if (!Number.isSafeInteger(k) || k < 1)
        throw new Error('RRF k must be a positive safe integer');
      params.k = { int64_value: k };
    }
    this.ops.push({ op: 'merge', params });
    return this;
  }

  /** @returns The function chain's protobuf-shaped object. */
  toProto(): FunctionChainSpec {
    return {
      name: this.name,
      stage: this.stage,
      ops: [...this.ops],
      ...(this.outputColumns.length
        ? { output_columns: [...this.outputColumns] }
        : {}),
    };
  }
}

export function serializeFunctionChains(
  chains?: FunctionChains
): FunctionChainSpec[] {
  if (chains === undefined) return [];

  const list = isChainList(chains) ? chains : [chains];
  return list.map(chain => {
    const spec = chain instanceof FunctionChain ? chain.toProto() : chain;
    if (!Number.isInteger(spec?.stage) || !Array.isArray(spec.ops)) {
      throw new Error(
        'function_chains must contain builders or specs with an integer stage and an ops array'
      );
    }
    return spec;
  });
}

function isChainList(
  chains: FunctionChains
): chains is readonly (FunctionChain | FunctionChainSpec)[] {
  return Array.isArray(chains);
}

/** Expression helpers for use with {@link FunctionChain.map}. */
export const fn = {
  /**
   * Combine two or more numeric columns.
   * @param columns - Columns in evaluation order.
   * @param options - Combination mode and weights for weighted mode.
   * @returns A num_combine expression.
   */
  numCombine(
    columns: readonly ColumnRef[],
    {
      mode = 'sum',
      weights,
    }: { mode?: NumCombineMode; weights?: readonly number[] } = {}
  ): FunctionChainExpr {
    if (!Array.isArray(columns) || columns.length < 2) {
      throw new Error('fn.numCombine requires at least two columns');
    }
    Array.from(columns, requireColumn);
    if (!['multiply', 'sum', 'max', 'min', 'avg', 'weighted'].includes(mode)) {
      throw new Error(`Unsupported num_combine mode: ${mode}`);
    }
    if (
      mode === 'weighted'
        ? weights?.length !== columns.length
        : weights !== undefined
    ) {
      throw new Error(
        'num_combine weights require weighted mode and must match the column count'
      );
    }
    const params: Record<string, FunctionParamValue> = {
      mode: { string_value: mode },
    };
    if (weights !== undefined) params.weights = weightsValue(weights);
    return { name: 'num_combine', args: [...columns], params };
  },

  /**
   * Compute a score based on the distance from an origin.
   * @param column - Numeric input column.
   * @param options - Decay function and its numeric parameters.
   * @returns A decay expression.
   */
  decay(
    column: ColumnRef,
    {
      function: kind,
      origin,
      scale,
      offset = 0,
      decay = 0.5,
    }: {
      function: 'gauss' | 'exp' | 'linear';
      origin: number;
      scale: number;
      offset?: number;
      decay?: number;
    }
  ): FunctionChainExpr {
    requireColumn(column);
    if (!['gauss', 'exp', 'linear'].includes(kind)) {
      throw new Error(`Unsupported decay function: ${kind}`);
    }
    return {
      name: 'decay',
      args: [column],
      params: {
        function: { string_value: kind },
        origin: doubleValue(origin),
        scale: doubleValue(scale),
        offset: doubleValue(offset),
        decay: doubleValue(decay),
      },
    };
  },

  /**
   * Round a numeric column to a fixed precision.
   * @param column - Numeric input column.
   * @param options - Number of decimal places.
   * @returns A round_decimal expression.
   */
  roundDecimal(
    column: ColumnRef,
    { decimal }: { decimal: number }
  ): FunctionChainExpr {
    requireColumn(column);
    if (!Number.isInteger(decimal) || decimal < 0 || decimal > 6) {
      throw new Error('round_decimal decimal must be an integer in [0, 6]');
    }
    return {
      name: 'round_decimal',
      args: [column],
      params: { decimal: { int64_value: decimal } },
    };
  },

  /**
   * Score a text column with the configured rerank provider.
   * @param column - Text input column.
   * @param options - Query strings and provider-specific parameters.
   * @returns A rerank_model expression.
   */
  rerankModel(
    column: ColumnRef,
    options: { queries: readonly string[]; [name: string]: ParamInput }
  ): FunctionChainExpr {
    requireColumn(column);
    const { queries } = options;
    if (
      !Array.isArray(queries) ||
      !queries.length ||
      Array.from(queries).some(query => typeof query !== 'string' || !query)
    ) {
      throw new Error(
        'rerank_model queries must be a non-empty array of strings'
      );
    }
    return { name: 'rerank_model', args: [column], params: paramMap(options) };
  },

  /**
   * Score numeric features with a registered UBJ XGBoost model.
   * @param features - Feature columns in model input order.
   * @param options - Milvus FileResource name and prediction mode.
   * @returns An xgboost expression.
   */
  xgboost(
    features: readonly ColumnRef[],
    {
      modelResource,
      output = 'default',
    }: { modelResource: string; output?: 'default' | 'raw' }
  ): FunctionChainExpr {
    if (!Array.isArray(features) || !features.length) {
      throw new Error('fn.xgboost requires at least one feature column');
    }
    Array.from(features, requireColumn);
    if (typeof modelResource !== 'string' || !modelResource) {
      throw new Error('xgboost modelResource must be a non-empty string');
    }
    if (output !== 'default' && output !== 'raw') {
      throw new Error('xgboost output must be default or raw');
    }
    return {
      name: 'xgboost',
      args: [...features],
      params: {
        model_resource: { string_value: modelResource },
        output: { string_value: output },
      },
    };
  },
};
