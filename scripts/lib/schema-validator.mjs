const KEYWORDS = new Set([
  '$id', '$ref', 'type', 'required', 'properties', 'additionalProperties',
  'enum', 'const', 'items', 'oneOf', 'anyOf', 'allOf',
]);
const TYPES = new Set(['null', 'boolean', 'object', 'array', 'number', 'integer', 'string']);

export class SchemaValidationError extends Error {
  constructor(code, message, details = {}) {
    super(`${code}: ${message}`);
    this.name = 'SchemaValidationError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new SchemaValidationError(code, message, details);
}

function equal(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right)
      && left.length === right.length
      && left.every((item, index) => equal(item, right[index]));
  }
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && equal(left[key], right[key]));
}

function hasDuplicates(values, comparator = (left, right) => left === right) {
  return values.some((value, index) => values.slice(0, index).some((other) => comparator(value, other)));
}

export function validateSchemaDefinition(schema, {
  resolveRef = () => undefined, seen = new Set(), active = new Set(), refStack = [], path = '$',
} = {}) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    fail('SCHEMA_DEFINITION_INVALID', `${path} must be an object`);
  }
  for (const keyword of Object.keys(schema)) {
    if (!KEYWORDS.has(keyword)) fail('SCHEMA_KEYWORD_UNSUPPORTED', `${path} uses unsupported keyword ${keyword}`);
  }
  if ('$id' in schema && (typeof schema.$id !== 'string' || !schema.$id)) {
    fail('SCHEMA_DEFINITION_INVALID', `${path}.$id must be a non-empty string`);
  }
  if (seen.has(schema)) return schema;
  seen.add(schema);
  active.add(schema);
  if ('$ref' in schema) {
    const resolved = typeof schema.$ref === 'string' ? resolveRef(schema.$ref) : undefined;
    if (!resolved) {
      fail('SCHEMA_REF_UNKNOWN', `${path} references unknown contract ${schema.$ref}`);
    }
    if (refStack.includes(schema.$ref) || active.has(resolved)) {
      fail('SCHEMA_REF_CYCLE', `${path} contains recursive reference ${schema.$ref}`);
    }
    validateSchemaDefinition(resolved, {
      resolveRef, seen, active, refStack: [...refStack, schema.$ref], path: `${path}.$ref(${schema.$ref})`,
    });
  }
  if ('type' in schema) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.length || types.some((type) => !TYPES.has(type)) || hasDuplicates(types)) {
      fail('SCHEMA_DEFINITION_INVALID', `${path}.type is invalid`);
    }
  }
  if ('required' in schema && (!Array.isArray(schema.required)
    || schema.required.some((item) => typeof item !== 'string')
    || hasDuplicates(schema.required))) {
    fail('SCHEMA_DEFINITION_INVALID', `${path}.required must be a string array`);
  }
  if ('enum' in schema && (!Array.isArray(schema.enum)
    || schema.enum.length === 0
    || hasDuplicates(schema.enum, equal))) {
    fail('SCHEMA_DEFINITION_INVALID', `${path}.enum must be a non-empty array`);
  }
  if ('properties' in schema) {
    if (!schema.properties || typeof schema.properties !== 'object' || Array.isArray(schema.properties)) {
      fail('SCHEMA_DEFINITION_INVALID', `${path}.properties must be an object`);
    }
    for (const [key, child] of Object.entries(schema.properties)) {
      validateSchemaDefinition(child, {
        resolveRef, seen, active, refStack, path: `${path}.properties.${key}`,
      });
    }
  }
  if ('additionalProperties' in schema && typeof schema.additionalProperties !== 'boolean') {
    validateSchemaDefinition(schema.additionalProperties, {
      resolveRef, seen, active, refStack, path: `${path}.additionalProperties`,
    });
  }
  if ('items' in schema) validateSchemaDefinition(schema.items, {
    resolveRef, seen, active, refStack, path: `${path}.items`,
  });
  for (const keyword of ['oneOf', 'anyOf', 'allOf']) {
    if (!(keyword in schema)) continue;
    if (!Array.isArray(schema[keyword]) || !schema[keyword].length) {
      fail('SCHEMA_DEFINITION_INVALID', `${path}.${keyword} must be a non-empty array`);
    }
    schema[keyword].forEach((child, index) => validateSchemaDefinition(child, {
      resolveRef, seen, active, refStack, path: `${path}.${keyword}[${index}]`,
    }));
  }
  active.delete(schema);
  return schema;
}

function matchesType(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

export function validateSchemaValue(schema, value, {
  resolveRef = () => undefined, path = '$', refStack = [],
} = {}) {
  if (schema.$ref) {
    if (refStack.includes(schema.$ref)) {
      return [{ code: 'SCHEMA_REF_CYCLE', path, reference: schema.$ref }];
    }
    const resolved = resolveRef(schema.$ref);
    if (!resolved) return [{ code: 'SCHEMA_REF_UNKNOWN', path, reference: schema.$ref }];
    return validateSchemaValue(resolved, value, {
      resolveRef, path, refStack: [...refStack, schema.$ref],
    });
  }
  const errors = [];
  const types = schema.type ? (Array.isArray(schema.type) ? schema.type : [schema.type]) : [];
  if (types.length && !types.some((type) => matchesType(value, type))) {
    errors.push({ code: 'SCHEMA_TYPE', path, expected: types, actual: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value });
    return errors;
  }
  if (schema.enum && !schema.enum.some((item) => equal(item, value))) errors.push({ code: 'SCHEMA_ENUM', path });
  if ('const' in schema && !equal(schema.const, value)) errors.push({ code: 'SCHEMA_CONST', path });
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required || []) if (!(key in value)) errors.push({ code: 'SCHEMA_REQUIRED', path: `${path}.${key}` });
    for (const [key, child] of Object.entries(schema.properties || {})) {
      if (key in value) errors.push(...validateSchemaValue(child, value[key], { resolveRef, path: `${path}.${key}`, refStack }));
    }
    const extras = Object.keys(value).filter((key) => !(key in (schema.properties || {})));
    if (schema.additionalProperties === false) {
      for (const key of extras) errors.push({ code: 'SCHEMA_ADDITIONAL_PROPERTY', path: `${path}.${key}` });
    } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      for (const key of extras) errors.push(...validateSchemaValue(schema.additionalProperties, value[key], { resolveRef, path: `${path}.${key}`, refStack }));
    }
  }
  if (Array.isArray(value) && schema.items) value.forEach((item, index) => errors.push(...validateSchemaValue(schema.items, item, { resolveRef, path: `${path}[${index}]`, refStack })));
  if (schema.allOf) for (const child of schema.allOf) errors.push(...validateSchemaValue(child, value, { resolveRef, path, refStack }));
  if (schema.anyOf && !schema.anyOf.some((child) => validateSchemaValue(child, value, { resolveRef, path, refStack }).length === 0)) errors.push({ code: 'SCHEMA_ANY_OF', path });
  if (schema.oneOf && schema.oneOf.filter((child) => validateSchemaValue(child, value, { resolveRef, path, refStack }).length === 0).length !== 1) errors.push({ code: 'SCHEMA_ONE_OF', path });
  return errors;
}

export function assertSchemaValue(schema, value, options) {
  const errors = validateSchemaValue(schema, value, options);
  if (errors.length) fail('SCHEMA_VALUE_INVALID', `${errors[0].code} at ${errors[0].path}`, { errors });
  return value;
}
