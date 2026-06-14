
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model ORG
 * 
 */
export type ORG = $Result.DefaultSelection<Prisma.$ORGPayload>
/**
 * Model ORG_Invite
 * 
 */
export type ORG_Invite = $Result.DefaultSelection<Prisma.$ORG_InvitePayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more ORGS
 * const oRGS = await prisma.oRG.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more ORGS
   * const oRGS = await prisma.oRG.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.oRG`: Exposes CRUD operations for the **ORG** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ORGS
    * const oRGS = await prisma.oRG.findMany()
    * ```
    */
  get oRG(): Prisma.ORGDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.oRG_Invite`: Exposes CRUD operations for the **ORG_Invite** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ORG_Invites
    * const oRG_Invites = await prisma.oRG_Invite.findMany()
    * ```
    */
  get oRG_Invite(): Prisma.ORG_InviteDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 6.19.3
   * Query Engine version: c2990dca591cba766e3b7ef5d9e8a84796e47ab7
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    ORG: 'ORG',
    ORG_Invite: 'ORG_Invite'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "oRG" | "oRG_Invite"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      ORG: {
        payload: Prisma.$ORGPayload<ExtArgs>
        fields: Prisma.ORGFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ORGFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORGPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ORGFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORGPayload>
          }
          findFirst: {
            args: Prisma.ORGFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORGPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ORGFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORGPayload>
          }
          findMany: {
            args: Prisma.ORGFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORGPayload>[]
          }
          create: {
            args: Prisma.ORGCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORGPayload>
          }
          createMany: {
            args: Prisma.ORGCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ORGCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORGPayload>[]
          }
          delete: {
            args: Prisma.ORGDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORGPayload>
          }
          update: {
            args: Prisma.ORGUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORGPayload>
          }
          deleteMany: {
            args: Prisma.ORGDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ORGUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ORGUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORGPayload>[]
          }
          upsert: {
            args: Prisma.ORGUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORGPayload>
          }
          aggregate: {
            args: Prisma.ORGAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateORG>
          }
          groupBy: {
            args: Prisma.ORGGroupByArgs<ExtArgs>
            result: $Utils.Optional<ORGGroupByOutputType>[]
          }
          count: {
            args: Prisma.ORGCountArgs<ExtArgs>
            result: $Utils.Optional<ORGCountAggregateOutputType> | number
          }
        }
      }
      ORG_Invite: {
        payload: Prisma.$ORG_InvitePayload<ExtArgs>
        fields: Prisma.ORG_InviteFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ORG_InviteFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORG_InvitePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ORG_InviteFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORG_InvitePayload>
          }
          findFirst: {
            args: Prisma.ORG_InviteFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORG_InvitePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ORG_InviteFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORG_InvitePayload>
          }
          findMany: {
            args: Prisma.ORG_InviteFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORG_InvitePayload>[]
          }
          create: {
            args: Prisma.ORG_InviteCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORG_InvitePayload>
          }
          createMany: {
            args: Prisma.ORG_InviteCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ORG_InviteCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORG_InvitePayload>[]
          }
          delete: {
            args: Prisma.ORG_InviteDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORG_InvitePayload>
          }
          update: {
            args: Prisma.ORG_InviteUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORG_InvitePayload>
          }
          deleteMany: {
            args: Prisma.ORG_InviteDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ORG_InviteUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ORG_InviteUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORG_InvitePayload>[]
          }
          upsert: {
            args: Prisma.ORG_InviteUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ORG_InvitePayload>
          }
          aggregate: {
            args: Prisma.ORG_InviteAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateORG_Invite>
          }
          groupBy: {
            args: Prisma.ORG_InviteGroupByArgs<ExtArgs>
            result: $Utils.Optional<ORG_InviteGroupByOutputType>[]
          }
          count: {
            args: Prisma.ORG_InviteCountArgs<ExtArgs>
            result: $Utils.Optional<ORG_InviteCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory | null
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
  }
  export type GlobalOmitConfig = {
    oRG?: ORGOmit
    oRG_Invite?: ORG_InviteOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type ORGCountOutputType
   */

  export type ORGCountOutputType = {
    invites: number
  }

  export type ORGCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    invites?: boolean | ORGCountOutputTypeCountInvitesArgs
  }

  // Custom InputTypes
  /**
   * ORGCountOutputType without action
   */
  export type ORGCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORGCountOutputType
     */
    select?: ORGCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * ORGCountOutputType without action
   */
  export type ORGCountOutputTypeCountInvitesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ORG_InviteWhereInput
  }


  /**
   * Models
   */

  /**
   * Model ORG
   */

  export type AggregateORG = {
    _count: ORGCountAggregateOutputType | null
    _avg: ORGAvgAggregateOutputType | null
    _sum: ORGSumAggregateOutputType | null
    _min: ORGMinAggregateOutputType | null
    _max: ORGMaxAggregateOutputType | null
  }

  export type ORGAvgAggregateOutputType = {
    id: number | null
  }

  export type ORGSumAggregateOutputType = {
    id: number | null
  }

  export type ORGMinAggregateOutputType = {
    id: number | null
    slug: string | null
    name: string | null
    databaseUrl: string | null
    status: string | null
    ownerEmail: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ORGMaxAggregateOutputType = {
    id: number | null
    slug: string | null
    name: string | null
    databaseUrl: string | null
    status: string | null
    ownerEmail: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ORGCountAggregateOutputType = {
    id: number
    slug: number
    name: number
    databaseUrl: number
    status: number
    ownerEmail: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ORGAvgAggregateInputType = {
    id?: true
  }

  export type ORGSumAggregateInputType = {
    id?: true
  }

  export type ORGMinAggregateInputType = {
    id?: true
    slug?: true
    name?: true
    databaseUrl?: true
    status?: true
    ownerEmail?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ORGMaxAggregateInputType = {
    id?: true
    slug?: true
    name?: true
    databaseUrl?: true
    status?: true
    ownerEmail?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ORGCountAggregateInputType = {
    id?: true
    slug?: true
    name?: true
    databaseUrl?: true
    status?: true
    ownerEmail?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ORGAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ORG to aggregate.
     */
    where?: ORGWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ORGS to fetch.
     */
    orderBy?: ORGOrderByWithRelationInput | ORGOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ORGWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ORGS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ORGS.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ORGS
    **/
    _count?: true | ORGCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ORGAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ORGSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ORGMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ORGMaxAggregateInputType
  }

  export type GetORGAggregateType<T extends ORGAggregateArgs> = {
        [P in keyof T & keyof AggregateORG]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateORG[P]>
      : GetScalarType<T[P], AggregateORG[P]>
  }




  export type ORGGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ORGWhereInput
    orderBy?: ORGOrderByWithAggregationInput | ORGOrderByWithAggregationInput[]
    by: ORGScalarFieldEnum[] | ORGScalarFieldEnum
    having?: ORGScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ORGCountAggregateInputType | true
    _avg?: ORGAvgAggregateInputType
    _sum?: ORGSumAggregateInputType
    _min?: ORGMinAggregateInputType
    _max?: ORGMaxAggregateInputType
  }

  export type ORGGroupByOutputType = {
    id: number
    slug: string
    name: string
    databaseUrl: string
    status: string
    ownerEmail: string
    createdAt: Date
    updatedAt: Date
    _count: ORGCountAggregateOutputType | null
    _avg: ORGAvgAggregateOutputType | null
    _sum: ORGSumAggregateOutputType | null
    _min: ORGMinAggregateOutputType | null
    _max: ORGMaxAggregateOutputType | null
  }

  type GetORGGroupByPayload<T extends ORGGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ORGGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ORGGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ORGGroupByOutputType[P]>
            : GetScalarType<T[P], ORGGroupByOutputType[P]>
        }
      >
    >


  export type ORGSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    slug?: boolean
    name?: boolean
    databaseUrl?: boolean
    status?: boolean
    ownerEmail?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    invites?: boolean | ORG$invitesArgs<ExtArgs>
    _count?: boolean | ORGCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["oRG"]>

  export type ORGSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    slug?: boolean
    name?: boolean
    databaseUrl?: boolean
    status?: boolean
    ownerEmail?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["oRG"]>

  export type ORGSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    slug?: boolean
    name?: boolean
    databaseUrl?: boolean
    status?: boolean
    ownerEmail?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["oRG"]>

  export type ORGSelectScalar = {
    id?: boolean
    slug?: boolean
    name?: boolean
    databaseUrl?: boolean
    status?: boolean
    ownerEmail?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ORGOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "slug" | "name" | "databaseUrl" | "status" | "ownerEmail" | "createdAt" | "updatedAt", ExtArgs["result"]["oRG"]>
  export type ORGInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    invites?: boolean | ORG$invitesArgs<ExtArgs>
    _count?: boolean | ORGCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type ORGIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type ORGIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $ORGPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ORG"
    objects: {
      invites: Prisma.$ORG_InvitePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      slug: string
      name: string
      databaseUrl: string
      status: string
      ownerEmail: string
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["oRG"]>
    composites: {}
  }

  type ORGGetPayload<S extends boolean | null | undefined | ORGDefaultArgs> = $Result.GetResult<Prisma.$ORGPayload, S>

  type ORGCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ORGFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ORGCountAggregateInputType | true
    }

  export interface ORGDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ORG'], meta: { name: 'ORG' } }
    /**
     * Find zero or one ORG that matches the filter.
     * @param {ORGFindUniqueArgs} args - Arguments to find a ORG
     * @example
     * // Get one ORG
     * const oRG = await prisma.oRG.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ORGFindUniqueArgs>(args: SelectSubset<T, ORGFindUniqueArgs<ExtArgs>>): Prisma__ORGClient<$Result.GetResult<Prisma.$ORGPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ORG that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ORGFindUniqueOrThrowArgs} args - Arguments to find a ORG
     * @example
     * // Get one ORG
     * const oRG = await prisma.oRG.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ORGFindUniqueOrThrowArgs>(args: SelectSubset<T, ORGFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ORGClient<$Result.GetResult<Prisma.$ORGPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ORG that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ORGFindFirstArgs} args - Arguments to find a ORG
     * @example
     * // Get one ORG
     * const oRG = await prisma.oRG.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ORGFindFirstArgs>(args?: SelectSubset<T, ORGFindFirstArgs<ExtArgs>>): Prisma__ORGClient<$Result.GetResult<Prisma.$ORGPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ORG that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ORGFindFirstOrThrowArgs} args - Arguments to find a ORG
     * @example
     * // Get one ORG
     * const oRG = await prisma.oRG.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ORGFindFirstOrThrowArgs>(args?: SelectSubset<T, ORGFindFirstOrThrowArgs<ExtArgs>>): Prisma__ORGClient<$Result.GetResult<Prisma.$ORGPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ORGS that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ORGFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ORGS
     * const oRGS = await prisma.oRG.findMany()
     * 
     * // Get first 10 ORGS
     * const oRGS = await prisma.oRG.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const oRGWithIdOnly = await prisma.oRG.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ORGFindManyArgs>(args?: SelectSubset<T, ORGFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ORGPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ORG.
     * @param {ORGCreateArgs} args - Arguments to create a ORG.
     * @example
     * // Create one ORG
     * const ORG = await prisma.oRG.create({
     *   data: {
     *     // ... data to create a ORG
     *   }
     * })
     * 
     */
    create<T extends ORGCreateArgs>(args: SelectSubset<T, ORGCreateArgs<ExtArgs>>): Prisma__ORGClient<$Result.GetResult<Prisma.$ORGPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ORGS.
     * @param {ORGCreateManyArgs} args - Arguments to create many ORGS.
     * @example
     * // Create many ORGS
     * const oRG = await prisma.oRG.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ORGCreateManyArgs>(args?: SelectSubset<T, ORGCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ORGS and returns the data saved in the database.
     * @param {ORGCreateManyAndReturnArgs} args - Arguments to create many ORGS.
     * @example
     * // Create many ORGS
     * const oRG = await prisma.oRG.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ORGS and only return the `id`
     * const oRGWithIdOnly = await prisma.oRG.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ORGCreateManyAndReturnArgs>(args?: SelectSubset<T, ORGCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ORGPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ORG.
     * @param {ORGDeleteArgs} args - Arguments to delete one ORG.
     * @example
     * // Delete one ORG
     * const ORG = await prisma.oRG.delete({
     *   where: {
     *     // ... filter to delete one ORG
     *   }
     * })
     * 
     */
    delete<T extends ORGDeleteArgs>(args: SelectSubset<T, ORGDeleteArgs<ExtArgs>>): Prisma__ORGClient<$Result.GetResult<Prisma.$ORGPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ORG.
     * @param {ORGUpdateArgs} args - Arguments to update one ORG.
     * @example
     * // Update one ORG
     * const oRG = await prisma.oRG.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ORGUpdateArgs>(args: SelectSubset<T, ORGUpdateArgs<ExtArgs>>): Prisma__ORGClient<$Result.GetResult<Prisma.$ORGPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ORGS.
     * @param {ORGDeleteManyArgs} args - Arguments to filter ORGS to delete.
     * @example
     * // Delete a few ORGS
     * const { count } = await prisma.oRG.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ORGDeleteManyArgs>(args?: SelectSubset<T, ORGDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ORGS.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ORGUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ORGS
     * const oRG = await prisma.oRG.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ORGUpdateManyArgs>(args: SelectSubset<T, ORGUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ORGS and returns the data updated in the database.
     * @param {ORGUpdateManyAndReturnArgs} args - Arguments to update many ORGS.
     * @example
     * // Update many ORGS
     * const oRG = await prisma.oRG.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ORGS and only return the `id`
     * const oRGWithIdOnly = await prisma.oRG.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ORGUpdateManyAndReturnArgs>(args: SelectSubset<T, ORGUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ORGPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ORG.
     * @param {ORGUpsertArgs} args - Arguments to update or create a ORG.
     * @example
     * // Update or create a ORG
     * const oRG = await prisma.oRG.upsert({
     *   create: {
     *     // ... data to create a ORG
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ORG we want to update
     *   }
     * })
     */
    upsert<T extends ORGUpsertArgs>(args: SelectSubset<T, ORGUpsertArgs<ExtArgs>>): Prisma__ORGClient<$Result.GetResult<Prisma.$ORGPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ORGS.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ORGCountArgs} args - Arguments to filter ORGS to count.
     * @example
     * // Count the number of ORGS
     * const count = await prisma.oRG.count({
     *   where: {
     *     // ... the filter for the ORGS we want to count
     *   }
     * })
    **/
    count<T extends ORGCountArgs>(
      args?: Subset<T, ORGCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ORGCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ORG.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ORGAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ORGAggregateArgs>(args: Subset<T, ORGAggregateArgs>): Prisma.PrismaPromise<GetORGAggregateType<T>>

    /**
     * Group by ORG.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ORGGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ORGGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ORGGroupByArgs['orderBy'] }
        : { orderBy?: ORGGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ORGGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetORGGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ORG model
   */
  readonly fields: ORGFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ORG.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ORGClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    invites<T extends ORG$invitesArgs<ExtArgs> = {}>(args?: Subset<T, ORG$invitesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ORG_InvitePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ORG model
   */
  interface ORGFieldRefs {
    readonly id: FieldRef<"ORG", 'Int'>
    readonly slug: FieldRef<"ORG", 'String'>
    readonly name: FieldRef<"ORG", 'String'>
    readonly databaseUrl: FieldRef<"ORG", 'String'>
    readonly status: FieldRef<"ORG", 'String'>
    readonly ownerEmail: FieldRef<"ORG", 'String'>
    readonly createdAt: FieldRef<"ORG", 'DateTime'>
    readonly updatedAt: FieldRef<"ORG", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ORG findUnique
   */
  export type ORGFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG
     */
    select?: ORGSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG
     */
    omit?: ORGOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORGInclude<ExtArgs> | null
    /**
     * Filter, which ORG to fetch.
     */
    where: ORGWhereUniqueInput
  }

  /**
   * ORG findUniqueOrThrow
   */
  export type ORGFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG
     */
    select?: ORGSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG
     */
    omit?: ORGOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORGInclude<ExtArgs> | null
    /**
     * Filter, which ORG to fetch.
     */
    where: ORGWhereUniqueInput
  }

  /**
   * ORG findFirst
   */
  export type ORGFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG
     */
    select?: ORGSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG
     */
    omit?: ORGOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORGInclude<ExtArgs> | null
    /**
     * Filter, which ORG to fetch.
     */
    where?: ORGWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ORGS to fetch.
     */
    orderBy?: ORGOrderByWithRelationInput | ORGOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ORGS.
     */
    cursor?: ORGWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ORGS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ORGS.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ORGS.
     */
    distinct?: ORGScalarFieldEnum | ORGScalarFieldEnum[]
  }

  /**
   * ORG findFirstOrThrow
   */
  export type ORGFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG
     */
    select?: ORGSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG
     */
    omit?: ORGOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORGInclude<ExtArgs> | null
    /**
     * Filter, which ORG to fetch.
     */
    where?: ORGWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ORGS to fetch.
     */
    orderBy?: ORGOrderByWithRelationInput | ORGOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ORGS.
     */
    cursor?: ORGWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ORGS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ORGS.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ORGS.
     */
    distinct?: ORGScalarFieldEnum | ORGScalarFieldEnum[]
  }

  /**
   * ORG findMany
   */
  export type ORGFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG
     */
    select?: ORGSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG
     */
    omit?: ORGOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORGInclude<ExtArgs> | null
    /**
     * Filter, which ORGS to fetch.
     */
    where?: ORGWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ORGS to fetch.
     */
    orderBy?: ORGOrderByWithRelationInput | ORGOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ORGS.
     */
    cursor?: ORGWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ORGS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ORGS.
     */
    skip?: number
    distinct?: ORGScalarFieldEnum | ORGScalarFieldEnum[]
  }

  /**
   * ORG create
   */
  export type ORGCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG
     */
    select?: ORGSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG
     */
    omit?: ORGOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORGInclude<ExtArgs> | null
    /**
     * The data needed to create a ORG.
     */
    data: XOR<ORGCreateInput, ORGUncheckedCreateInput>
  }

  /**
   * ORG createMany
   */
  export type ORGCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ORGS.
     */
    data: ORGCreateManyInput | ORGCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ORG createManyAndReturn
   */
  export type ORGCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG
     */
    select?: ORGSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ORG
     */
    omit?: ORGOmit<ExtArgs> | null
    /**
     * The data used to create many ORGS.
     */
    data: ORGCreateManyInput | ORGCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ORG update
   */
  export type ORGUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG
     */
    select?: ORGSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG
     */
    omit?: ORGOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORGInclude<ExtArgs> | null
    /**
     * The data needed to update a ORG.
     */
    data: XOR<ORGUpdateInput, ORGUncheckedUpdateInput>
    /**
     * Choose, which ORG to update.
     */
    where: ORGWhereUniqueInput
  }

  /**
   * ORG updateMany
   */
  export type ORGUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ORGS.
     */
    data: XOR<ORGUpdateManyMutationInput, ORGUncheckedUpdateManyInput>
    /**
     * Filter which ORGS to update
     */
    where?: ORGWhereInput
    /**
     * Limit how many ORGS to update.
     */
    limit?: number
  }

  /**
   * ORG updateManyAndReturn
   */
  export type ORGUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG
     */
    select?: ORGSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ORG
     */
    omit?: ORGOmit<ExtArgs> | null
    /**
     * The data used to update ORGS.
     */
    data: XOR<ORGUpdateManyMutationInput, ORGUncheckedUpdateManyInput>
    /**
     * Filter which ORGS to update
     */
    where?: ORGWhereInput
    /**
     * Limit how many ORGS to update.
     */
    limit?: number
  }

  /**
   * ORG upsert
   */
  export type ORGUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG
     */
    select?: ORGSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG
     */
    omit?: ORGOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORGInclude<ExtArgs> | null
    /**
     * The filter to search for the ORG to update in case it exists.
     */
    where: ORGWhereUniqueInput
    /**
     * In case the ORG found by the `where` argument doesn't exist, create a new ORG with this data.
     */
    create: XOR<ORGCreateInput, ORGUncheckedCreateInput>
    /**
     * In case the ORG was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ORGUpdateInput, ORGUncheckedUpdateInput>
  }

  /**
   * ORG delete
   */
  export type ORGDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG
     */
    select?: ORGSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG
     */
    omit?: ORGOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORGInclude<ExtArgs> | null
    /**
     * Filter which ORG to delete.
     */
    where: ORGWhereUniqueInput
  }

  /**
   * ORG deleteMany
   */
  export type ORGDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ORGS to delete
     */
    where?: ORGWhereInput
    /**
     * Limit how many ORGS to delete.
     */
    limit?: number
  }

  /**
   * ORG.invites
   */
  export type ORG$invitesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG_Invite
     */
    select?: ORG_InviteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG_Invite
     */
    omit?: ORG_InviteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORG_InviteInclude<ExtArgs> | null
    where?: ORG_InviteWhereInput
    orderBy?: ORG_InviteOrderByWithRelationInput | ORG_InviteOrderByWithRelationInput[]
    cursor?: ORG_InviteWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ORG_InviteScalarFieldEnum | ORG_InviteScalarFieldEnum[]
  }

  /**
   * ORG without action
   */
  export type ORGDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG
     */
    select?: ORGSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG
     */
    omit?: ORGOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORGInclude<ExtArgs> | null
  }


  /**
   * Model ORG_Invite
   */

  export type AggregateORG_Invite = {
    _count: ORG_InviteCountAggregateOutputType | null
    _avg: ORG_InviteAvgAggregateOutputType | null
    _sum: ORG_InviteSumAggregateOutputType | null
    _min: ORG_InviteMinAggregateOutputType | null
    _max: ORG_InviteMaxAggregateOutputType | null
  }

  export type ORG_InviteAvgAggregateOutputType = {
    id: number | null
    orgId: number | null
  }

  export type ORG_InviteSumAggregateOutputType = {
    id: number | null
    orgId: number | null
  }

  export type ORG_InviteMinAggregateOutputType = {
    id: number | null
    orgId: number | null
    email: string | null
    token: string | null
    expiresAt: Date | null
    usedAt: Date | null
    createdAt: Date | null
  }

  export type ORG_InviteMaxAggregateOutputType = {
    id: number | null
    orgId: number | null
    email: string | null
    token: string | null
    expiresAt: Date | null
    usedAt: Date | null
    createdAt: Date | null
  }

  export type ORG_InviteCountAggregateOutputType = {
    id: number
    orgId: number
    email: number
    token: number
    expiresAt: number
    usedAt: number
    createdAt: number
    _all: number
  }


  export type ORG_InviteAvgAggregateInputType = {
    id?: true
    orgId?: true
  }

  export type ORG_InviteSumAggregateInputType = {
    id?: true
    orgId?: true
  }

  export type ORG_InviteMinAggregateInputType = {
    id?: true
    orgId?: true
    email?: true
    token?: true
    expiresAt?: true
    usedAt?: true
    createdAt?: true
  }

  export type ORG_InviteMaxAggregateInputType = {
    id?: true
    orgId?: true
    email?: true
    token?: true
    expiresAt?: true
    usedAt?: true
    createdAt?: true
  }

  export type ORG_InviteCountAggregateInputType = {
    id?: true
    orgId?: true
    email?: true
    token?: true
    expiresAt?: true
    usedAt?: true
    createdAt?: true
    _all?: true
  }

  export type ORG_InviteAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ORG_Invite to aggregate.
     */
    where?: ORG_InviteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ORG_Invites to fetch.
     */
    orderBy?: ORG_InviteOrderByWithRelationInput | ORG_InviteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ORG_InviteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ORG_Invites from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ORG_Invites.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ORG_Invites
    **/
    _count?: true | ORG_InviteCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ORG_InviteAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ORG_InviteSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ORG_InviteMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ORG_InviteMaxAggregateInputType
  }

  export type GetORG_InviteAggregateType<T extends ORG_InviteAggregateArgs> = {
        [P in keyof T & keyof AggregateORG_Invite]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateORG_Invite[P]>
      : GetScalarType<T[P], AggregateORG_Invite[P]>
  }




  export type ORG_InviteGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ORG_InviteWhereInput
    orderBy?: ORG_InviteOrderByWithAggregationInput | ORG_InviteOrderByWithAggregationInput[]
    by: ORG_InviteScalarFieldEnum[] | ORG_InviteScalarFieldEnum
    having?: ORG_InviteScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ORG_InviteCountAggregateInputType | true
    _avg?: ORG_InviteAvgAggregateInputType
    _sum?: ORG_InviteSumAggregateInputType
    _min?: ORG_InviteMinAggregateInputType
    _max?: ORG_InviteMaxAggregateInputType
  }

  export type ORG_InviteGroupByOutputType = {
    id: number
    orgId: number | null
    email: string
    token: string
    expiresAt: Date
    usedAt: Date | null
    createdAt: Date
    _count: ORG_InviteCountAggregateOutputType | null
    _avg: ORG_InviteAvgAggregateOutputType | null
    _sum: ORG_InviteSumAggregateOutputType | null
    _min: ORG_InviteMinAggregateOutputType | null
    _max: ORG_InviteMaxAggregateOutputType | null
  }

  type GetORG_InviteGroupByPayload<T extends ORG_InviteGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ORG_InviteGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ORG_InviteGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ORG_InviteGroupByOutputType[P]>
            : GetScalarType<T[P], ORG_InviteGroupByOutputType[P]>
        }
      >
    >


  export type ORG_InviteSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    orgId?: boolean
    email?: boolean
    token?: boolean
    expiresAt?: boolean
    usedAt?: boolean
    createdAt?: boolean
    org?: boolean | ORG_Invite$orgArgs<ExtArgs>
  }, ExtArgs["result"]["oRG_Invite"]>

  export type ORG_InviteSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    orgId?: boolean
    email?: boolean
    token?: boolean
    expiresAt?: boolean
    usedAt?: boolean
    createdAt?: boolean
    org?: boolean | ORG_Invite$orgArgs<ExtArgs>
  }, ExtArgs["result"]["oRG_Invite"]>

  export type ORG_InviteSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    orgId?: boolean
    email?: boolean
    token?: boolean
    expiresAt?: boolean
    usedAt?: boolean
    createdAt?: boolean
    org?: boolean | ORG_Invite$orgArgs<ExtArgs>
  }, ExtArgs["result"]["oRG_Invite"]>

  export type ORG_InviteSelectScalar = {
    id?: boolean
    orgId?: boolean
    email?: boolean
    token?: boolean
    expiresAt?: boolean
    usedAt?: boolean
    createdAt?: boolean
  }

  export type ORG_InviteOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "orgId" | "email" | "token" | "expiresAt" | "usedAt" | "createdAt", ExtArgs["result"]["oRG_Invite"]>
  export type ORG_InviteInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    org?: boolean | ORG_Invite$orgArgs<ExtArgs>
  }
  export type ORG_InviteIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    org?: boolean | ORG_Invite$orgArgs<ExtArgs>
  }
  export type ORG_InviteIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    org?: boolean | ORG_Invite$orgArgs<ExtArgs>
  }

  export type $ORG_InvitePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ORG_Invite"
    objects: {
      org: Prisma.$ORGPayload<ExtArgs> | null
    }
    scalars: $Extensions.GetPayloadResult<{
      id: number
      orgId: number | null
      email: string
      token: string
      expiresAt: Date
      usedAt: Date | null
      createdAt: Date
    }, ExtArgs["result"]["oRG_Invite"]>
    composites: {}
  }

  type ORG_InviteGetPayload<S extends boolean | null | undefined | ORG_InviteDefaultArgs> = $Result.GetResult<Prisma.$ORG_InvitePayload, S>

  type ORG_InviteCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ORG_InviteFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ORG_InviteCountAggregateInputType | true
    }

  export interface ORG_InviteDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ORG_Invite'], meta: { name: 'ORG_Invite' } }
    /**
     * Find zero or one ORG_Invite that matches the filter.
     * @param {ORG_InviteFindUniqueArgs} args - Arguments to find a ORG_Invite
     * @example
     * // Get one ORG_Invite
     * const oRG_Invite = await prisma.oRG_Invite.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ORG_InviteFindUniqueArgs>(args: SelectSubset<T, ORG_InviteFindUniqueArgs<ExtArgs>>): Prisma__ORG_InviteClient<$Result.GetResult<Prisma.$ORG_InvitePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ORG_Invite that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ORG_InviteFindUniqueOrThrowArgs} args - Arguments to find a ORG_Invite
     * @example
     * // Get one ORG_Invite
     * const oRG_Invite = await prisma.oRG_Invite.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ORG_InviteFindUniqueOrThrowArgs>(args: SelectSubset<T, ORG_InviteFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ORG_InviteClient<$Result.GetResult<Prisma.$ORG_InvitePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ORG_Invite that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ORG_InviteFindFirstArgs} args - Arguments to find a ORG_Invite
     * @example
     * // Get one ORG_Invite
     * const oRG_Invite = await prisma.oRG_Invite.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ORG_InviteFindFirstArgs>(args?: SelectSubset<T, ORG_InviteFindFirstArgs<ExtArgs>>): Prisma__ORG_InviteClient<$Result.GetResult<Prisma.$ORG_InvitePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ORG_Invite that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ORG_InviteFindFirstOrThrowArgs} args - Arguments to find a ORG_Invite
     * @example
     * // Get one ORG_Invite
     * const oRG_Invite = await prisma.oRG_Invite.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ORG_InviteFindFirstOrThrowArgs>(args?: SelectSubset<T, ORG_InviteFindFirstOrThrowArgs<ExtArgs>>): Prisma__ORG_InviteClient<$Result.GetResult<Prisma.$ORG_InvitePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ORG_Invites that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ORG_InviteFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ORG_Invites
     * const oRG_Invites = await prisma.oRG_Invite.findMany()
     * 
     * // Get first 10 ORG_Invites
     * const oRG_Invites = await prisma.oRG_Invite.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const oRG_InviteWithIdOnly = await prisma.oRG_Invite.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ORG_InviteFindManyArgs>(args?: SelectSubset<T, ORG_InviteFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ORG_InvitePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ORG_Invite.
     * @param {ORG_InviteCreateArgs} args - Arguments to create a ORG_Invite.
     * @example
     * // Create one ORG_Invite
     * const ORG_Invite = await prisma.oRG_Invite.create({
     *   data: {
     *     // ... data to create a ORG_Invite
     *   }
     * })
     * 
     */
    create<T extends ORG_InviteCreateArgs>(args: SelectSubset<T, ORG_InviteCreateArgs<ExtArgs>>): Prisma__ORG_InviteClient<$Result.GetResult<Prisma.$ORG_InvitePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ORG_Invites.
     * @param {ORG_InviteCreateManyArgs} args - Arguments to create many ORG_Invites.
     * @example
     * // Create many ORG_Invites
     * const oRG_Invite = await prisma.oRG_Invite.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ORG_InviteCreateManyArgs>(args?: SelectSubset<T, ORG_InviteCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ORG_Invites and returns the data saved in the database.
     * @param {ORG_InviteCreateManyAndReturnArgs} args - Arguments to create many ORG_Invites.
     * @example
     * // Create many ORG_Invites
     * const oRG_Invite = await prisma.oRG_Invite.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ORG_Invites and only return the `id`
     * const oRG_InviteWithIdOnly = await prisma.oRG_Invite.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ORG_InviteCreateManyAndReturnArgs>(args?: SelectSubset<T, ORG_InviteCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ORG_InvitePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ORG_Invite.
     * @param {ORG_InviteDeleteArgs} args - Arguments to delete one ORG_Invite.
     * @example
     * // Delete one ORG_Invite
     * const ORG_Invite = await prisma.oRG_Invite.delete({
     *   where: {
     *     // ... filter to delete one ORG_Invite
     *   }
     * })
     * 
     */
    delete<T extends ORG_InviteDeleteArgs>(args: SelectSubset<T, ORG_InviteDeleteArgs<ExtArgs>>): Prisma__ORG_InviteClient<$Result.GetResult<Prisma.$ORG_InvitePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ORG_Invite.
     * @param {ORG_InviteUpdateArgs} args - Arguments to update one ORG_Invite.
     * @example
     * // Update one ORG_Invite
     * const oRG_Invite = await prisma.oRG_Invite.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ORG_InviteUpdateArgs>(args: SelectSubset<T, ORG_InviteUpdateArgs<ExtArgs>>): Prisma__ORG_InviteClient<$Result.GetResult<Prisma.$ORG_InvitePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ORG_Invites.
     * @param {ORG_InviteDeleteManyArgs} args - Arguments to filter ORG_Invites to delete.
     * @example
     * // Delete a few ORG_Invites
     * const { count } = await prisma.oRG_Invite.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ORG_InviteDeleteManyArgs>(args?: SelectSubset<T, ORG_InviteDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ORG_Invites.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ORG_InviteUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ORG_Invites
     * const oRG_Invite = await prisma.oRG_Invite.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ORG_InviteUpdateManyArgs>(args: SelectSubset<T, ORG_InviteUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ORG_Invites and returns the data updated in the database.
     * @param {ORG_InviteUpdateManyAndReturnArgs} args - Arguments to update many ORG_Invites.
     * @example
     * // Update many ORG_Invites
     * const oRG_Invite = await prisma.oRG_Invite.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ORG_Invites and only return the `id`
     * const oRG_InviteWithIdOnly = await prisma.oRG_Invite.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ORG_InviteUpdateManyAndReturnArgs>(args: SelectSubset<T, ORG_InviteUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ORG_InvitePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ORG_Invite.
     * @param {ORG_InviteUpsertArgs} args - Arguments to update or create a ORG_Invite.
     * @example
     * // Update or create a ORG_Invite
     * const oRG_Invite = await prisma.oRG_Invite.upsert({
     *   create: {
     *     // ... data to create a ORG_Invite
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ORG_Invite we want to update
     *   }
     * })
     */
    upsert<T extends ORG_InviteUpsertArgs>(args: SelectSubset<T, ORG_InviteUpsertArgs<ExtArgs>>): Prisma__ORG_InviteClient<$Result.GetResult<Prisma.$ORG_InvitePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ORG_Invites.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ORG_InviteCountArgs} args - Arguments to filter ORG_Invites to count.
     * @example
     * // Count the number of ORG_Invites
     * const count = await prisma.oRG_Invite.count({
     *   where: {
     *     // ... the filter for the ORG_Invites we want to count
     *   }
     * })
    **/
    count<T extends ORG_InviteCountArgs>(
      args?: Subset<T, ORG_InviteCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ORG_InviteCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ORG_Invite.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ORG_InviteAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ORG_InviteAggregateArgs>(args: Subset<T, ORG_InviteAggregateArgs>): Prisma.PrismaPromise<GetORG_InviteAggregateType<T>>

    /**
     * Group by ORG_Invite.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ORG_InviteGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ORG_InviteGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ORG_InviteGroupByArgs['orderBy'] }
        : { orderBy?: ORG_InviteGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ORG_InviteGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetORG_InviteGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ORG_Invite model
   */
  readonly fields: ORG_InviteFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ORG_Invite.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ORG_InviteClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    org<T extends ORG_Invite$orgArgs<ExtArgs> = {}>(args?: Subset<T, ORG_Invite$orgArgs<ExtArgs>>): Prisma__ORGClient<$Result.GetResult<Prisma.$ORGPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ORG_Invite model
   */
  interface ORG_InviteFieldRefs {
    readonly id: FieldRef<"ORG_Invite", 'Int'>
    readonly orgId: FieldRef<"ORG_Invite", 'Int'>
    readonly email: FieldRef<"ORG_Invite", 'String'>
    readonly token: FieldRef<"ORG_Invite", 'String'>
    readonly expiresAt: FieldRef<"ORG_Invite", 'DateTime'>
    readonly usedAt: FieldRef<"ORG_Invite", 'DateTime'>
    readonly createdAt: FieldRef<"ORG_Invite", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ORG_Invite findUnique
   */
  export type ORG_InviteFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG_Invite
     */
    select?: ORG_InviteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG_Invite
     */
    omit?: ORG_InviteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORG_InviteInclude<ExtArgs> | null
    /**
     * Filter, which ORG_Invite to fetch.
     */
    where: ORG_InviteWhereUniqueInput
  }

  /**
   * ORG_Invite findUniqueOrThrow
   */
  export type ORG_InviteFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG_Invite
     */
    select?: ORG_InviteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG_Invite
     */
    omit?: ORG_InviteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORG_InviteInclude<ExtArgs> | null
    /**
     * Filter, which ORG_Invite to fetch.
     */
    where: ORG_InviteWhereUniqueInput
  }

  /**
   * ORG_Invite findFirst
   */
  export type ORG_InviteFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG_Invite
     */
    select?: ORG_InviteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG_Invite
     */
    omit?: ORG_InviteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORG_InviteInclude<ExtArgs> | null
    /**
     * Filter, which ORG_Invite to fetch.
     */
    where?: ORG_InviteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ORG_Invites to fetch.
     */
    orderBy?: ORG_InviteOrderByWithRelationInput | ORG_InviteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ORG_Invites.
     */
    cursor?: ORG_InviteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ORG_Invites from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ORG_Invites.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ORG_Invites.
     */
    distinct?: ORG_InviteScalarFieldEnum | ORG_InviteScalarFieldEnum[]
  }

  /**
   * ORG_Invite findFirstOrThrow
   */
  export type ORG_InviteFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG_Invite
     */
    select?: ORG_InviteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG_Invite
     */
    omit?: ORG_InviteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORG_InviteInclude<ExtArgs> | null
    /**
     * Filter, which ORG_Invite to fetch.
     */
    where?: ORG_InviteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ORG_Invites to fetch.
     */
    orderBy?: ORG_InviteOrderByWithRelationInput | ORG_InviteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ORG_Invites.
     */
    cursor?: ORG_InviteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ORG_Invites from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ORG_Invites.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ORG_Invites.
     */
    distinct?: ORG_InviteScalarFieldEnum | ORG_InviteScalarFieldEnum[]
  }

  /**
   * ORG_Invite findMany
   */
  export type ORG_InviteFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG_Invite
     */
    select?: ORG_InviteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG_Invite
     */
    omit?: ORG_InviteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORG_InviteInclude<ExtArgs> | null
    /**
     * Filter, which ORG_Invites to fetch.
     */
    where?: ORG_InviteWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ORG_Invites to fetch.
     */
    orderBy?: ORG_InviteOrderByWithRelationInput | ORG_InviteOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ORG_Invites.
     */
    cursor?: ORG_InviteWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ORG_Invites from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ORG_Invites.
     */
    skip?: number
    distinct?: ORG_InviteScalarFieldEnum | ORG_InviteScalarFieldEnum[]
  }

  /**
   * ORG_Invite create
   */
  export type ORG_InviteCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG_Invite
     */
    select?: ORG_InviteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG_Invite
     */
    omit?: ORG_InviteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORG_InviteInclude<ExtArgs> | null
    /**
     * The data needed to create a ORG_Invite.
     */
    data: XOR<ORG_InviteCreateInput, ORG_InviteUncheckedCreateInput>
  }

  /**
   * ORG_Invite createMany
   */
  export type ORG_InviteCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ORG_Invites.
     */
    data: ORG_InviteCreateManyInput | ORG_InviteCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ORG_Invite createManyAndReturn
   */
  export type ORG_InviteCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG_Invite
     */
    select?: ORG_InviteSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ORG_Invite
     */
    omit?: ORG_InviteOmit<ExtArgs> | null
    /**
     * The data used to create many ORG_Invites.
     */
    data: ORG_InviteCreateManyInput | ORG_InviteCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORG_InviteIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ORG_Invite update
   */
  export type ORG_InviteUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG_Invite
     */
    select?: ORG_InviteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG_Invite
     */
    omit?: ORG_InviteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORG_InviteInclude<ExtArgs> | null
    /**
     * The data needed to update a ORG_Invite.
     */
    data: XOR<ORG_InviteUpdateInput, ORG_InviteUncheckedUpdateInput>
    /**
     * Choose, which ORG_Invite to update.
     */
    where: ORG_InviteWhereUniqueInput
  }

  /**
   * ORG_Invite updateMany
   */
  export type ORG_InviteUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ORG_Invites.
     */
    data: XOR<ORG_InviteUpdateManyMutationInput, ORG_InviteUncheckedUpdateManyInput>
    /**
     * Filter which ORG_Invites to update
     */
    where?: ORG_InviteWhereInput
    /**
     * Limit how many ORG_Invites to update.
     */
    limit?: number
  }

  /**
   * ORG_Invite updateManyAndReturn
   */
  export type ORG_InviteUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG_Invite
     */
    select?: ORG_InviteSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ORG_Invite
     */
    omit?: ORG_InviteOmit<ExtArgs> | null
    /**
     * The data used to update ORG_Invites.
     */
    data: XOR<ORG_InviteUpdateManyMutationInput, ORG_InviteUncheckedUpdateManyInput>
    /**
     * Filter which ORG_Invites to update
     */
    where?: ORG_InviteWhereInput
    /**
     * Limit how many ORG_Invites to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORG_InviteIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * ORG_Invite upsert
   */
  export type ORG_InviteUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG_Invite
     */
    select?: ORG_InviteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG_Invite
     */
    omit?: ORG_InviteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORG_InviteInclude<ExtArgs> | null
    /**
     * The filter to search for the ORG_Invite to update in case it exists.
     */
    where: ORG_InviteWhereUniqueInput
    /**
     * In case the ORG_Invite found by the `where` argument doesn't exist, create a new ORG_Invite with this data.
     */
    create: XOR<ORG_InviteCreateInput, ORG_InviteUncheckedCreateInput>
    /**
     * In case the ORG_Invite was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ORG_InviteUpdateInput, ORG_InviteUncheckedUpdateInput>
  }

  /**
   * ORG_Invite delete
   */
  export type ORG_InviteDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG_Invite
     */
    select?: ORG_InviteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG_Invite
     */
    omit?: ORG_InviteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORG_InviteInclude<ExtArgs> | null
    /**
     * Filter which ORG_Invite to delete.
     */
    where: ORG_InviteWhereUniqueInput
  }

  /**
   * ORG_Invite deleteMany
   */
  export type ORG_InviteDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ORG_Invites to delete
     */
    where?: ORG_InviteWhereInput
    /**
     * Limit how many ORG_Invites to delete.
     */
    limit?: number
  }

  /**
   * ORG_Invite.org
   */
  export type ORG_Invite$orgArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG
     */
    select?: ORGSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG
     */
    omit?: ORGOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORGInclude<ExtArgs> | null
    where?: ORGWhereInput
  }

  /**
   * ORG_Invite without action
   */
  export type ORG_InviteDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ORG_Invite
     */
    select?: ORG_InviteSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ORG_Invite
     */
    omit?: ORG_InviteOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ORG_InviteInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const ORGScalarFieldEnum: {
    id: 'id',
    slug: 'slug',
    name: 'name',
    databaseUrl: 'databaseUrl',
    status: 'status',
    ownerEmail: 'ownerEmail',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ORGScalarFieldEnum = (typeof ORGScalarFieldEnum)[keyof typeof ORGScalarFieldEnum]


  export const ORG_InviteScalarFieldEnum: {
    id: 'id',
    orgId: 'orgId',
    email: 'email',
    token: 'token',
    expiresAt: 'expiresAt',
    usedAt: 'usedAt',
    createdAt: 'createdAt'
  };

  export type ORG_InviteScalarFieldEnum = (typeof ORG_InviteScalarFieldEnum)[keyof typeof ORG_InviteScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type ORGWhereInput = {
    AND?: ORGWhereInput | ORGWhereInput[]
    OR?: ORGWhereInput[]
    NOT?: ORGWhereInput | ORGWhereInput[]
    id?: IntFilter<"ORG"> | number
    slug?: StringFilter<"ORG"> | string
    name?: StringFilter<"ORG"> | string
    databaseUrl?: StringFilter<"ORG"> | string
    status?: StringFilter<"ORG"> | string
    ownerEmail?: StringFilter<"ORG"> | string
    createdAt?: DateTimeFilter<"ORG"> | Date | string
    updatedAt?: DateTimeFilter<"ORG"> | Date | string
    invites?: ORG_InviteListRelationFilter
  }

  export type ORGOrderByWithRelationInput = {
    id?: SortOrder
    slug?: SortOrder
    name?: SortOrder
    databaseUrl?: SortOrder
    status?: SortOrder
    ownerEmail?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    invites?: ORG_InviteOrderByRelationAggregateInput
  }

  export type ORGWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    slug?: string
    AND?: ORGWhereInput | ORGWhereInput[]
    OR?: ORGWhereInput[]
    NOT?: ORGWhereInput | ORGWhereInput[]
    name?: StringFilter<"ORG"> | string
    databaseUrl?: StringFilter<"ORG"> | string
    status?: StringFilter<"ORG"> | string
    ownerEmail?: StringFilter<"ORG"> | string
    createdAt?: DateTimeFilter<"ORG"> | Date | string
    updatedAt?: DateTimeFilter<"ORG"> | Date | string
    invites?: ORG_InviteListRelationFilter
  }, "id" | "slug">

  export type ORGOrderByWithAggregationInput = {
    id?: SortOrder
    slug?: SortOrder
    name?: SortOrder
    databaseUrl?: SortOrder
    status?: SortOrder
    ownerEmail?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ORGCountOrderByAggregateInput
    _avg?: ORGAvgOrderByAggregateInput
    _max?: ORGMaxOrderByAggregateInput
    _min?: ORGMinOrderByAggregateInput
    _sum?: ORGSumOrderByAggregateInput
  }

  export type ORGScalarWhereWithAggregatesInput = {
    AND?: ORGScalarWhereWithAggregatesInput | ORGScalarWhereWithAggregatesInput[]
    OR?: ORGScalarWhereWithAggregatesInput[]
    NOT?: ORGScalarWhereWithAggregatesInput | ORGScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"ORG"> | number
    slug?: StringWithAggregatesFilter<"ORG"> | string
    name?: StringWithAggregatesFilter<"ORG"> | string
    databaseUrl?: StringWithAggregatesFilter<"ORG"> | string
    status?: StringWithAggregatesFilter<"ORG"> | string
    ownerEmail?: StringWithAggregatesFilter<"ORG"> | string
    createdAt?: DateTimeWithAggregatesFilter<"ORG"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"ORG"> | Date | string
  }

  export type ORG_InviteWhereInput = {
    AND?: ORG_InviteWhereInput | ORG_InviteWhereInput[]
    OR?: ORG_InviteWhereInput[]
    NOT?: ORG_InviteWhereInput | ORG_InviteWhereInput[]
    id?: IntFilter<"ORG_Invite"> | number
    orgId?: IntNullableFilter<"ORG_Invite"> | number | null
    email?: StringFilter<"ORG_Invite"> | string
    token?: StringFilter<"ORG_Invite"> | string
    expiresAt?: DateTimeFilter<"ORG_Invite"> | Date | string
    usedAt?: DateTimeNullableFilter<"ORG_Invite"> | Date | string | null
    createdAt?: DateTimeFilter<"ORG_Invite"> | Date | string
    org?: XOR<ORGNullableScalarRelationFilter, ORGWhereInput> | null
  }

  export type ORG_InviteOrderByWithRelationInput = {
    id?: SortOrder
    orgId?: SortOrderInput | SortOrder
    email?: SortOrder
    token?: SortOrder
    expiresAt?: SortOrder
    usedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    org?: ORGOrderByWithRelationInput
  }

  export type ORG_InviteWhereUniqueInput = Prisma.AtLeast<{
    id?: number
    token?: string
    AND?: ORG_InviteWhereInput | ORG_InviteWhereInput[]
    OR?: ORG_InviteWhereInput[]
    NOT?: ORG_InviteWhereInput | ORG_InviteWhereInput[]
    orgId?: IntNullableFilter<"ORG_Invite"> | number | null
    email?: StringFilter<"ORG_Invite"> | string
    expiresAt?: DateTimeFilter<"ORG_Invite"> | Date | string
    usedAt?: DateTimeNullableFilter<"ORG_Invite"> | Date | string | null
    createdAt?: DateTimeFilter<"ORG_Invite"> | Date | string
    org?: XOR<ORGNullableScalarRelationFilter, ORGWhereInput> | null
  }, "id" | "token">

  export type ORG_InviteOrderByWithAggregationInput = {
    id?: SortOrder
    orgId?: SortOrderInput | SortOrder
    email?: SortOrder
    token?: SortOrder
    expiresAt?: SortOrder
    usedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: ORG_InviteCountOrderByAggregateInput
    _avg?: ORG_InviteAvgOrderByAggregateInput
    _max?: ORG_InviteMaxOrderByAggregateInput
    _min?: ORG_InviteMinOrderByAggregateInput
    _sum?: ORG_InviteSumOrderByAggregateInput
  }

  export type ORG_InviteScalarWhereWithAggregatesInput = {
    AND?: ORG_InviteScalarWhereWithAggregatesInput | ORG_InviteScalarWhereWithAggregatesInput[]
    OR?: ORG_InviteScalarWhereWithAggregatesInput[]
    NOT?: ORG_InviteScalarWhereWithAggregatesInput | ORG_InviteScalarWhereWithAggregatesInput[]
    id?: IntWithAggregatesFilter<"ORG_Invite"> | number
    orgId?: IntNullableWithAggregatesFilter<"ORG_Invite"> | number | null
    email?: StringWithAggregatesFilter<"ORG_Invite"> | string
    token?: StringWithAggregatesFilter<"ORG_Invite"> | string
    expiresAt?: DateTimeWithAggregatesFilter<"ORG_Invite"> | Date | string
    usedAt?: DateTimeNullableWithAggregatesFilter<"ORG_Invite"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"ORG_Invite"> | Date | string
  }

  export type ORGCreateInput = {
    slug: string
    name: string
    databaseUrl: string
    status?: string
    ownerEmail: string
    createdAt?: Date | string
    updatedAt?: Date | string
    invites?: ORG_InviteCreateNestedManyWithoutOrgInput
  }

  export type ORGUncheckedCreateInput = {
    id?: number
    slug: string
    name: string
    databaseUrl: string
    status?: string
    ownerEmail: string
    createdAt?: Date | string
    updatedAt?: Date | string
    invites?: ORG_InviteUncheckedCreateNestedManyWithoutOrgInput
  }

  export type ORGUpdateInput = {
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    databaseUrl?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    ownerEmail?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    invites?: ORG_InviteUpdateManyWithoutOrgNestedInput
  }

  export type ORGUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    databaseUrl?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    ownerEmail?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    invites?: ORG_InviteUncheckedUpdateManyWithoutOrgNestedInput
  }

  export type ORGCreateManyInput = {
    id?: number
    slug: string
    name: string
    databaseUrl: string
    status?: string
    ownerEmail: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ORGUpdateManyMutationInput = {
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    databaseUrl?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    ownerEmail?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ORGUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    databaseUrl?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    ownerEmail?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ORG_InviteCreateInput = {
    email: string
    token: string
    expiresAt: Date | string
    usedAt?: Date | string | null
    createdAt?: Date | string
    org?: ORGCreateNestedOneWithoutInvitesInput
  }

  export type ORG_InviteUncheckedCreateInput = {
    id?: number
    orgId?: number | null
    email: string
    token: string
    expiresAt: Date | string
    usedAt?: Date | string | null
    createdAt?: Date | string
  }

  export type ORG_InviteUpdateInput = {
    email?: StringFieldUpdateOperationsInput | string
    token?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    org?: ORGUpdateOneWithoutInvitesNestedInput
  }

  export type ORG_InviteUncheckedUpdateInput = {
    id?: IntFieldUpdateOperationsInput | number
    orgId?: NullableIntFieldUpdateOperationsInput | number | null
    email?: StringFieldUpdateOperationsInput | string
    token?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ORG_InviteCreateManyInput = {
    id?: number
    orgId?: number | null
    email: string
    token: string
    expiresAt: Date | string
    usedAt?: Date | string | null
    createdAt?: Date | string
  }

  export type ORG_InviteUpdateManyMutationInput = {
    email?: StringFieldUpdateOperationsInput | string
    token?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ORG_InviteUncheckedUpdateManyInput = {
    id?: IntFieldUpdateOperationsInput | number
    orgId?: NullableIntFieldUpdateOperationsInput | number | null
    email?: StringFieldUpdateOperationsInput | string
    token?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type ORG_InviteListRelationFilter = {
    every?: ORG_InviteWhereInput
    some?: ORG_InviteWhereInput
    none?: ORG_InviteWhereInput
  }

  export type ORG_InviteOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ORGCountOrderByAggregateInput = {
    id?: SortOrder
    slug?: SortOrder
    name?: SortOrder
    databaseUrl?: SortOrder
    status?: SortOrder
    ownerEmail?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ORGAvgOrderByAggregateInput = {
    id?: SortOrder
  }

  export type ORGMaxOrderByAggregateInput = {
    id?: SortOrder
    slug?: SortOrder
    name?: SortOrder
    databaseUrl?: SortOrder
    status?: SortOrder
    ownerEmail?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ORGMinOrderByAggregateInput = {
    id?: SortOrder
    slug?: SortOrder
    name?: SortOrder
    databaseUrl?: SortOrder
    status?: SortOrder
    ownerEmail?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ORGSumOrderByAggregateInput = {
    id?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type ORGNullableScalarRelationFilter = {
    is?: ORGWhereInput | null
    isNot?: ORGWhereInput | null
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type ORG_InviteCountOrderByAggregateInput = {
    id?: SortOrder
    orgId?: SortOrder
    email?: SortOrder
    token?: SortOrder
    expiresAt?: SortOrder
    usedAt?: SortOrder
    createdAt?: SortOrder
  }

  export type ORG_InviteAvgOrderByAggregateInput = {
    id?: SortOrder
    orgId?: SortOrder
  }

  export type ORG_InviteMaxOrderByAggregateInput = {
    id?: SortOrder
    orgId?: SortOrder
    email?: SortOrder
    token?: SortOrder
    expiresAt?: SortOrder
    usedAt?: SortOrder
    createdAt?: SortOrder
  }

  export type ORG_InviteMinOrderByAggregateInput = {
    id?: SortOrder
    orgId?: SortOrder
    email?: SortOrder
    token?: SortOrder
    expiresAt?: SortOrder
    usedAt?: SortOrder
    createdAt?: SortOrder
  }

  export type ORG_InviteSumOrderByAggregateInput = {
    id?: SortOrder
    orgId?: SortOrder
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type ORG_InviteCreateNestedManyWithoutOrgInput = {
    create?: XOR<ORG_InviteCreateWithoutOrgInput, ORG_InviteUncheckedCreateWithoutOrgInput> | ORG_InviteCreateWithoutOrgInput[] | ORG_InviteUncheckedCreateWithoutOrgInput[]
    connectOrCreate?: ORG_InviteCreateOrConnectWithoutOrgInput | ORG_InviteCreateOrConnectWithoutOrgInput[]
    createMany?: ORG_InviteCreateManyOrgInputEnvelope
    connect?: ORG_InviteWhereUniqueInput | ORG_InviteWhereUniqueInput[]
  }

  export type ORG_InviteUncheckedCreateNestedManyWithoutOrgInput = {
    create?: XOR<ORG_InviteCreateWithoutOrgInput, ORG_InviteUncheckedCreateWithoutOrgInput> | ORG_InviteCreateWithoutOrgInput[] | ORG_InviteUncheckedCreateWithoutOrgInput[]
    connectOrCreate?: ORG_InviteCreateOrConnectWithoutOrgInput | ORG_InviteCreateOrConnectWithoutOrgInput[]
    createMany?: ORG_InviteCreateManyOrgInputEnvelope
    connect?: ORG_InviteWhereUniqueInput | ORG_InviteWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type ORG_InviteUpdateManyWithoutOrgNestedInput = {
    create?: XOR<ORG_InviteCreateWithoutOrgInput, ORG_InviteUncheckedCreateWithoutOrgInput> | ORG_InviteCreateWithoutOrgInput[] | ORG_InviteUncheckedCreateWithoutOrgInput[]
    connectOrCreate?: ORG_InviteCreateOrConnectWithoutOrgInput | ORG_InviteCreateOrConnectWithoutOrgInput[]
    upsert?: ORG_InviteUpsertWithWhereUniqueWithoutOrgInput | ORG_InviteUpsertWithWhereUniqueWithoutOrgInput[]
    createMany?: ORG_InviteCreateManyOrgInputEnvelope
    set?: ORG_InviteWhereUniqueInput | ORG_InviteWhereUniqueInput[]
    disconnect?: ORG_InviteWhereUniqueInput | ORG_InviteWhereUniqueInput[]
    delete?: ORG_InviteWhereUniqueInput | ORG_InviteWhereUniqueInput[]
    connect?: ORG_InviteWhereUniqueInput | ORG_InviteWhereUniqueInput[]
    update?: ORG_InviteUpdateWithWhereUniqueWithoutOrgInput | ORG_InviteUpdateWithWhereUniqueWithoutOrgInput[]
    updateMany?: ORG_InviteUpdateManyWithWhereWithoutOrgInput | ORG_InviteUpdateManyWithWhereWithoutOrgInput[]
    deleteMany?: ORG_InviteScalarWhereInput | ORG_InviteScalarWhereInput[]
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type ORG_InviteUncheckedUpdateManyWithoutOrgNestedInput = {
    create?: XOR<ORG_InviteCreateWithoutOrgInput, ORG_InviteUncheckedCreateWithoutOrgInput> | ORG_InviteCreateWithoutOrgInput[] | ORG_InviteUncheckedCreateWithoutOrgInput[]
    connectOrCreate?: ORG_InviteCreateOrConnectWithoutOrgInput | ORG_InviteCreateOrConnectWithoutOrgInput[]
    upsert?: ORG_InviteUpsertWithWhereUniqueWithoutOrgInput | ORG_InviteUpsertWithWhereUniqueWithoutOrgInput[]
    createMany?: ORG_InviteCreateManyOrgInputEnvelope
    set?: ORG_InviteWhereUniqueInput | ORG_InviteWhereUniqueInput[]
    disconnect?: ORG_InviteWhereUniqueInput | ORG_InviteWhereUniqueInput[]
    delete?: ORG_InviteWhereUniqueInput | ORG_InviteWhereUniqueInput[]
    connect?: ORG_InviteWhereUniqueInput | ORG_InviteWhereUniqueInput[]
    update?: ORG_InviteUpdateWithWhereUniqueWithoutOrgInput | ORG_InviteUpdateWithWhereUniqueWithoutOrgInput[]
    updateMany?: ORG_InviteUpdateManyWithWhereWithoutOrgInput | ORG_InviteUpdateManyWithWhereWithoutOrgInput[]
    deleteMany?: ORG_InviteScalarWhereInput | ORG_InviteScalarWhereInput[]
  }

  export type ORGCreateNestedOneWithoutInvitesInput = {
    create?: XOR<ORGCreateWithoutInvitesInput, ORGUncheckedCreateWithoutInvitesInput>
    connectOrCreate?: ORGCreateOrConnectWithoutInvitesInput
    connect?: ORGWhereUniqueInput
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type ORGUpdateOneWithoutInvitesNestedInput = {
    create?: XOR<ORGCreateWithoutInvitesInput, ORGUncheckedCreateWithoutInvitesInput>
    connectOrCreate?: ORGCreateOrConnectWithoutInvitesInput
    upsert?: ORGUpsertWithoutInvitesInput
    disconnect?: ORGWhereInput | boolean
    delete?: ORGWhereInput | boolean
    connect?: ORGWhereUniqueInput
    update?: XOR<XOR<ORGUpdateToOneWithWhereWithoutInvitesInput, ORGUpdateWithoutInvitesInput>, ORGUncheckedUpdateWithoutInvitesInput>
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type ORG_InviteCreateWithoutOrgInput = {
    email: string
    token: string
    expiresAt: Date | string
    usedAt?: Date | string | null
    createdAt?: Date | string
  }

  export type ORG_InviteUncheckedCreateWithoutOrgInput = {
    id?: number
    email: string
    token: string
    expiresAt: Date | string
    usedAt?: Date | string | null
    createdAt?: Date | string
  }

  export type ORG_InviteCreateOrConnectWithoutOrgInput = {
    where: ORG_InviteWhereUniqueInput
    create: XOR<ORG_InviteCreateWithoutOrgInput, ORG_InviteUncheckedCreateWithoutOrgInput>
  }

  export type ORG_InviteCreateManyOrgInputEnvelope = {
    data: ORG_InviteCreateManyOrgInput | ORG_InviteCreateManyOrgInput[]
    skipDuplicates?: boolean
  }

  export type ORG_InviteUpsertWithWhereUniqueWithoutOrgInput = {
    where: ORG_InviteWhereUniqueInput
    update: XOR<ORG_InviteUpdateWithoutOrgInput, ORG_InviteUncheckedUpdateWithoutOrgInput>
    create: XOR<ORG_InviteCreateWithoutOrgInput, ORG_InviteUncheckedCreateWithoutOrgInput>
  }

  export type ORG_InviteUpdateWithWhereUniqueWithoutOrgInput = {
    where: ORG_InviteWhereUniqueInput
    data: XOR<ORG_InviteUpdateWithoutOrgInput, ORG_InviteUncheckedUpdateWithoutOrgInput>
  }

  export type ORG_InviteUpdateManyWithWhereWithoutOrgInput = {
    where: ORG_InviteScalarWhereInput
    data: XOR<ORG_InviteUpdateManyMutationInput, ORG_InviteUncheckedUpdateManyWithoutOrgInput>
  }

  export type ORG_InviteScalarWhereInput = {
    AND?: ORG_InviteScalarWhereInput | ORG_InviteScalarWhereInput[]
    OR?: ORG_InviteScalarWhereInput[]
    NOT?: ORG_InviteScalarWhereInput | ORG_InviteScalarWhereInput[]
    id?: IntFilter<"ORG_Invite"> | number
    orgId?: IntNullableFilter<"ORG_Invite"> | number | null
    email?: StringFilter<"ORG_Invite"> | string
    token?: StringFilter<"ORG_Invite"> | string
    expiresAt?: DateTimeFilter<"ORG_Invite"> | Date | string
    usedAt?: DateTimeNullableFilter<"ORG_Invite"> | Date | string | null
    createdAt?: DateTimeFilter<"ORG_Invite"> | Date | string
  }

  export type ORGCreateWithoutInvitesInput = {
    slug: string
    name: string
    databaseUrl: string
    status?: string
    ownerEmail: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ORGUncheckedCreateWithoutInvitesInput = {
    id?: number
    slug: string
    name: string
    databaseUrl: string
    status?: string
    ownerEmail: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ORGCreateOrConnectWithoutInvitesInput = {
    where: ORGWhereUniqueInput
    create: XOR<ORGCreateWithoutInvitesInput, ORGUncheckedCreateWithoutInvitesInput>
  }

  export type ORGUpsertWithoutInvitesInput = {
    update: XOR<ORGUpdateWithoutInvitesInput, ORGUncheckedUpdateWithoutInvitesInput>
    create: XOR<ORGCreateWithoutInvitesInput, ORGUncheckedCreateWithoutInvitesInput>
    where?: ORGWhereInput
  }

  export type ORGUpdateToOneWithWhereWithoutInvitesInput = {
    where?: ORGWhereInput
    data: XOR<ORGUpdateWithoutInvitesInput, ORGUncheckedUpdateWithoutInvitesInput>
  }

  export type ORGUpdateWithoutInvitesInput = {
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    databaseUrl?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    ownerEmail?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ORGUncheckedUpdateWithoutInvitesInput = {
    id?: IntFieldUpdateOperationsInput | number
    slug?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    databaseUrl?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    ownerEmail?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ORG_InviteCreateManyOrgInput = {
    id?: number
    email: string
    token: string
    expiresAt: Date | string
    usedAt?: Date | string | null
    createdAt?: Date | string
  }

  export type ORG_InviteUpdateWithoutOrgInput = {
    email?: StringFieldUpdateOperationsInput | string
    token?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ORG_InviteUncheckedUpdateWithoutOrgInput = {
    id?: IntFieldUpdateOperationsInput | number
    email?: StringFieldUpdateOperationsInput | string
    token?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ORG_InviteUncheckedUpdateManyWithoutOrgInput = {
    id?: IntFieldUpdateOperationsInput | number
    email?: StringFieldUpdateOperationsInput | string
    token?: StringFieldUpdateOperationsInput | string
    expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
    usedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}