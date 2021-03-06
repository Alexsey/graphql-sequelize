import {
   GraphQLInt,
   GraphQLString,
   GraphQLBoolean,
   GraphQLFloat,
   GraphQLEnumType,
   GraphQLList
 } from 'graphql';
import JSONType from './types/jsonType';
import _ from 'lodash';

let customTypeMapper;
/**
 * A function to set a custom mapping of types
 * @param {Function} mapFunc
 */
export function mapType(mapFunc) {
  customTypeMapper = mapFunc;
}


/**
 * Checks the type of the sequelize data type and
 * returns the corresponding type in GraphQL
 * @param  {Object} sequelizeType
 * @param  {Object} sequelizeTypes
 * @return {Function} GraphQL type declaration
 */
export function toGraphQL(sequelizeType, sequelizeTypes) {

  // did the user supply a mapping function?
  // use their mapping, if it returns truthy
  // else use our defaults
  if (customTypeMapper) {
    let result = customTypeMapper(sequelizeType);
    if (result) return result;
  }

  const {
    BOOLEAN,
    ENUM,
    FLOAT,
    CHAR,
    DECIMAL,
    DOUBLE,
    INTEGER,
    BIGINT,
    STRING,
    TEXT,
    UUID,
    DATE,
    DATEONLY,
    TIME,
    ARRAY,
    VIRTUAL,
    JSON
  } = sequelizeTypes;



  // Regex for finding special characters
  const specialChars = /[^a-z\d_]/i;

  if (sequelizeType instanceof BOOLEAN) return GraphQLBoolean;

  if (sequelizeType instanceof FLOAT ||
      sequelizeType instanceof DOUBLE) return GraphQLFloat;

  if (sequelizeType instanceof INTEGER) {
    return GraphQLInt;
  }

  if (sequelizeType instanceof CHAR ||
      sequelizeType instanceof STRING ||
      sequelizeType instanceof TEXT ||
      sequelizeType instanceof UUID ||
      sequelizeType instanceof DATE ||
      sequelizeType instanceof DATEONLY ||
      sequelizeType instanceof TIME ||
      sequelizeType instanceof BIGINT ||
      sequelizeType instanceof DECIMAL) {
    return GraphQLString;
  }

  if (sequelizeType instanceof ARRAY) {
    let elementType = toGraphQL(sequelizeType.type, sequelizeTypes);
    return new GraphQLList(elementType);
  }

  if (sequelizeType instanceof ENUM) {
    return new GraphQLEnumType({
      name: 'tempEnumName',
      values: _(sequelizeType.values)
        .mapKeys(sanitizeEnumValue)
        .mapValues(v => ({value: v}))
        .value()
    });
  }

  if (sequelizeType instanceof VIRTUAL) {
    let returnType = sequelizeType.returnType
        ? toGraphQL(sequelizeType.returnType, sequelizeTypes)
        : GraphQLString;
    return returnType;
  }

  if (sequelizeType instanceof JSON) {
    return JSONType;
  }

  throw new Error(`Unable to convert ${sequelizeType.key || sequelizeType.toSql()} to a GraphQL type`);

  function sanitizeEnumValue(value) {
    return value
      .replace(/(^\d)/, '_$1')
      .split(specialChars)
      .map((v, i) => i ? _.upperFirst(v) : v)
      .join('');
  }
}
