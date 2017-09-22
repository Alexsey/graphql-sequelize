import { GraphQLList } from 'graphql';
import _ from 'lodash';
import argsToFindOptions from './argsToFindOptions';
import { isConnection, handleConnection, nodeType } from './relay';
import invariant from 'assert';
import dataLoaderSequelize from 'dataloader-sequelize';

function whereQueryVarsToValues(o, vals) {
  _.assign(o, _.cloneDeepWith(o, v => _.isFunction(v) ? v(vals) : undefined));
}

function getDeeplyAssociatedModels(model) {
  const deeplyAssociatedModels = [];

  (function getRelatedModels(model) {
    const newAssociatedModels = _(model.associations)
      .map('target')
      .without(...deeplyAssociatedModels).value();
    deeplyAssociatedModels.push(...newAssociatedModels);
    newAssociatedModels.forEach(getRelatedModels);
  }(model));

  return deeplyAssociatedModels;
}

function isArrayOfArrays(obj) {
  return Array.isArray(obj) && Array.isArray(obj[0]);
}

function resolverFactory(target, options = {}) {
  dataLoaderSequelize(target);

  let targetAttributes
    , isModel = !!target.getTableName
    , isAssociation = !!target.associationType
    , association = isAssociation && target
    , model = isAssociation && target.target || isModel && target;

  targetAttributes = _.get(model, '_scope.attributes', Object.keys(model.rawAttributes));

  options = _.cloneDeep(options);

  invariant(options.include === undefined, 'Include support has been removed in favor of dataloader batching');
  if (options.before === undefined) options.before = (options) => options;
  if (options.after === undefined) options.after = (result) => result;
  if (options.handleConnection === undefined) options.handleConnection = true;
  if (options.allowedIncludes) {
    options.allowedIncludes = _(options.allowedIncludes)
      .map(include => _.isString(include) ? [include, include] : include)
      .fromPairs().invert().value();

    const associatedModels = _.keyBy(getDeeplyAssociatedModels(model), 'name');

    _.forEach(options.allowedIncludes, included =>
      invariant(associatedModels[included], `can't allow to includes model "${included}" ` +
        `for model "${model.name}" because there is no association chain between them`)
    );
  }

  return async (source, args, context = {}, info) => {
    whereQueryVarsToValues(args.where, info.variableValues);
    let type = info.returnType
      , list = options.list || type instanceof GraphQLList
      , findOptions = argsToFindOptions(args, targetAttributes, model, options.allowedIncludes);

    if (_.get(model, '_scope.order')) {
      if (!findOptions.order) {
        findOptions.order = model._scope.order;
      } else if (isArrayOfArrays(model._scope.order)) {
        findOptions.order = [...model._scope.order, ...findOptions.order];
      } else {
        findOptions.order = [model._scope.order, ...findOptions.order];
      }
    }

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
