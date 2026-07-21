import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertSchemaValue, SchemaValidationError, validateSchemaDefinition, validateSchemaValue } from '../scripts/lib/schema-validator.mjs';

test('rejects unsupported keywords and unknown refs', () => {
  assert.throws(() => validateSchemaDefinition({ type: 'string', minLength: 1 }), (error) => error instanceof SchemaValidationError && error.code === 'SCHEMA_KEYWORD_UNSUPPORTED');
  assert.throws(() => validateSchemaDefinition({ $ref: 'missing' }), (error) => error.code === 'SCHEMA_REF_UNKNOWN');
  assert.throws(() => validateSchemaDefinition({ enum: 'x' }), (error) => error.code === 'SCHEMA_DEFINITION_INVALID');
  assert.throws(() => validateSchemaDefinition({ $id: 1 }), (error) => error.code === 'SCHEMA_DEFINITION_INVALID');
  assert.throws(() => validateSchemaDefinition({ type: ['string', 'string'] }), (error) => error.code === 'SCHEMA_DEFINITION_INVALID');
  assert.throws(() => validateSchemaDefinition({ required: ['id', 'id'] }), (error) => error.code === 'SCHEMA_DEFINITION_INVALID');
  assert.throws(() => validateSchemaDefinition({ enum: [{ a: 1 }, { a: 1 }] }), (error) => error.code === 'SCHEMA_DEFINITION_INVALID');
});

test('rejects recursive refs deterministically', () => {
  const refs = new Map();
  refs.set('a', { $ref: 'b' });
  refs.set('b', { $ref: 'a' });
  assert.throws(
    () => validateSchemaDefinition(refs.get('a'), { resolveRef: (id) => refs.get(id) }),
    (error) => error instanceof SchemaValidationError && error.code === 'SCHEMA_REF_CYCLE',
  );
  assert.deepEqual(
    validateSchemaValue(refs.get('a'), 'value', { resolveRef: (id) => refs.get(id) }),
    [{ code: 'SCHEMA_REF_CYCLE', path: '$', reference: 'b' }],
  );

  const node = { type: 'object', properties: { child: { $ref: 'node' } } };
  assert.throws(
    () => validateSchemaDefinition(node, { resolveRef: (id) => id === 'node' ? node : undefined }),
    (error) => error instanceof SchemaValidationError && error.code === 'SCHEMA_REF_CYCLE',
  );
});

test('validates type, required and additional properties', () => {
  const schema = { type: 'object', required: ['name'], properties: { name: { type: 'string' } }, additionalProperties: false };
  validateSchemaDefinition(schema);
  assert.deepEqual(validateSchemaValue(schema, { name: 'ok' }), []);
  assert.deepEqual(validateSchemaValue(schema, { name: 1, extra: true }).map((item) => item.code), ['SCHEMA_TYPE', 'SCHEMA_ADDITIONAL_PROPERTY']);
  assert.throws(() => assertSchemaValue(schema, {}), (error) => error.code === 'SCHEMA_VALUE_INVALID');
});

test('supports enum, const, items and composition', () => {
  const refs = new Map([['word', { type: 'string' }]]);
  const resolveRef = (id) => refs.get(id);
  const schema = { allOf: [{ type: 'array', items: { $ref: 'word' } }, { anyOf: [{ const: ['a'] }, { const: ['b'] }] }] };
  validateSchemaDefinition(schema, { resolveRef });
  assert.deepEqual(validateSchemaValue(schema, ['a'], { resolveRef }), []);
  assert.ok(validateSchemaValue(schema, [1], { resolveRef }).length > 0);
  assert.deepEqual(validateSchemaValue({ oneOf: [{ type: 'string' }, { const: 'x' }] }, 'x').map((item) => item.code), ['SCHEMA_ONE_OF']);
  assert.deepEqual(validateSchemaValue({ const: { a: 1, b: 2 } }, { b: 2, a: 1 }), []);
});
