import { GraphQLList } from 'graphql';
import _ from 'lodash';
import argsToFindOptions from './argsToFindOptions';
import { isConnection, handleConnection, nodeType } from './relay';
import invariant from 'assert';
import dataLoaderSequelize from 'dataloader-sequelize';

function whereQueryVarsToValues(o, vals) {
  if (!_.isEmpty(vals)) {
    convert(o, vals);
  }

  function convert(o) {
    _.forEach(o, (v, k) => {
      if (typeof v === 'function') {
        o[k] = o[k](vals);
      } else if (v && typeof v === 'object') {
        convert(v);
      }
    });
  }
}

function fulfillIncludesWithModels(includes, model) {
  if (!_.isArray(includes)) return;
  includes.forEach(included => {
    if (_.isString(included.model)) {
      // todo add good error message for bad non-find
      const association = _.find(model.associations, a => a.options.name.singular === included.model);
      included.model = association.target;
      included.as = association.options.as;
      // todo test conversion of inner includes
      fulfillIncludesWithModels(included.include, association.target);
    }
  });
}

function resolverFactory(target, options) {
  dataLoaderSequelize(target);

  let targetAttributes
    , isModel = !!target.getTableName
    , isAssociation = !!target.associationType
    , association = isAssociation && target
    , model = isAssociation && target.target || isModel && target;

  targetAttributes = Object.keys(model.rawAttributes);

  options = options || {};

  invariant(options.include === undefined, 'Include support has been removed in favor of dataloader batching');
  if (options.before === undefined) options.before = (options) => options;
  if (options.after === undefined) options.after = (result) => result;
  if (options.handleConnection === undefined) options.handleConnection = true;

  return async (source, args, context = {}, info) => {
    whereQueryVarsToValues(args.where, info.variableValues);
    fulfillIncludesWithModels(args.include, model);
    let type = info.returnType
      , list = options.list || type instanceof GraphQLList
      , findOptions = argsToFindOptions(args, targetAttributes);

    info = {...info, type, source};

    if (isConnection(type)) {
      type = nodeType(type);
    }

    type = type.ofType || type;

    findOptions.attributes = targetAttributes;
    findOptions.logging = findOptions.logging || context.logging;

    findOptions = await options.before(findOptions, args, context, info);
    if (list && !findOptions.order) {
      findOptions.order = [[model.primaryKeyAttribute, 'ASC']];
    }

    let result;
    if (association) {
      result = await source[association.accessors.get](findOptions);
      if (options.handleConnection && isConnection(info.returnType)) {
        result = handleConnection(result, args);
      }
    } else {
      result = await model[list ? 'findAll' : 'findOne'](findOptions);
    }

    return options.after(result, args, context, info);
  };
}

module.exports = resolverFactory;
