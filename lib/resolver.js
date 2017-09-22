'use strict';

var _bluebird = require('bluebird');

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _graphql = require('graphql');

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _argsToFindOptions = require('./argsToFindOptions');

var _argsToFindOptions2 = _interopRequireDefault(_argsToFindOptions);

var _relay = require('./relay');

var _assert = require('assert');

var _assert2 = _interopRequireDefault(_assert);

var _dataloaderSequelize = require('dataloader-sequelize');

var _dataloaderSequelize2 = _interopRequireDefault(_dataloaderSequelize);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i]; return arr2; } else { return Array.from(arr); } }

function whereQueryVarsToValues(o, vals) {
  _lodash2.default.assign(o, _lodash2.default.cloneDeepWith(o, v => _lodash2.default.isFunction(v) ? v(vals) : undefined));
}

function getDeeplyAssociatedModels(model) {
  const deeplyAssociatedModels = [];

  (function getRelatedModels(model) {
    var _$map;

    const newAssociatedModels = (_$map = (0, _lodash2.default)(model.associations).map('target')).without.apply(_$map, deeplyAssociatedModels).value();
    deeplyAssociatedModels.push.apply(deeplyAssociatedModels, _toConsumableArray(newAssociatedModels));
    newAssociatedModels.forEach(getRelatedModels);
  })(model);

  return deeplyAssociatedModels;
}

function isArrayOfArrays(obj) {
  return Array.isArray(obj) && Array.isArray(obj[0]);
}

function resolverFactory(target) {
  let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  (0, _dataloaderSequelize2.default)(target);

  let targetAttributes,
      isModel = !!target.getTableName,
      isAssociation = !!target.associationType,
      association = isAssociation && target,
      model = isAssociation && target.target || isModel && target;

  targetAttributes = _lodash2.default.get(model, '_scope.attributes', Object.keys(model.rawAttributes));

  options = _lodash2.default.cloneDeep(options);

  (0, _assert2.default)(options.include === undefined, 'Include support has been removed in favor of dataloader batching');
  if (options.before === undefined) options.before = options => options;
  if (options.after === undefined) options.after = result => result;
  if (options.handleConnection === undefined) options.handleConnection = true;
  if (options.allowedIncludes) {
    options.allowedIncludes = (0, _lodash2.default)(options.allowedIncludes).map(include => _lodash2.default.isString(include) ? [include, include] : include).fromPairs().invert().value();

    const associatedModels = _lodash2.default.keyBy(getDeeplyAssociatedModels(model), 'name');

    _lodash2.default.forEach(options.allowedIncludes, included => (0, _assert2.default)(associatedModels[included], `can't allow to includes model "${included}" ` + `for model "${model.name}" because there is no association chain between them`));
  }

  return (() => {
    var _ref = (0, _bluebird.coroutine)(function* (source, args) {
      let context = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      let info = arguments[3];

      whereQueryVarsToValues(args.where, info.variableValues);
      let type = info.returnType,
          list = options.list || type instanceof _graphql.GraphQLList,
          findOptions = (0, _argsToFindOptions2.default)(args, targetAttributes, model, options.allowedIncludes);

      if (_lodash2.default.get(model, '_scope.order')) {
        if (!findOptions.order) {
          findOptions.order = model._scope.order;
        } else if (isArrayOfArrays(model._scope.order)) {
          findOptions.order = [].concat(_toConsumableArray(model._scope.order), _toConsumableArray(findOptions.order));
        } else {
          findOptions.order = [model._scope.order].concat(_toConsumableArray(findOptions.order));
        }
      }

      info = _extends({}, info, { type: type, source: source });

      if ((0, _relay.isConnection)(type)) {
        type = (0, _relay.nodeType)(type);
      }

      type = type.ofType || type;

      findOptions.attributes = targetAttributes;
      findOptions.logging = findOptions.logging || context.logging;

      findOptions = yield options.before(findOptions, args, context, info);
      if (list && !findOptions.order) {
        findOptions.order = [[model.primaryKeyAttribute, 'ASC']];
      }

      let result;
      if (association) {
        result = yield source[association.accessors.get](findOptions);
        if (options.handleConnection && (0, _relay.isConnection)(info.returnType)) {
          result = (0, _relay.handleConnection)(result, args);
        }
      } else {
        result = yield model[list ? 'findAll' : 'findOne'](findOptions);
      }

      return options.after(result, args, context, info);
    });

    return function (_x3, _x4) {
      return _ref.apply(this, arguments);
    };
  })();
}

module.exports = resolverFactory;