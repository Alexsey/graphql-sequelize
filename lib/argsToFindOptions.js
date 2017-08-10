'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = argsToFindOptions;

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _replaceWhereOperators = require('./replaceWhereOperators');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function fulfillIncludesWithModels(includes, model) {
  let allowedIncludes = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

  if (!includes) return;
  if (!_lodash2.default.isArray(includes)) throw Error(`include must be an Array but got ${JSON.stringify(includes)}`);
  includes.forEach(included => {
    if (_lodash2.default.isString(included.model)) {
      const includedModelName = allowedIncludes[included.model];
      if (!includedModelName) throw Error(`model "${model.name}" has no allowance to include "${included.model}"`);

      const association = _lodash2.default.find(model.associations, a => a.target.name === includedModelName);
      if (!association) throw Error(`model "${model.name}" is not associate with "${included.model}"`);

      included.model = association.target;
      included.as = association.options.as;
      fulfillIncludesWithModels(included.include, association.target, allowedIncludes);
    }
  });
}

function argsToFindOptions(args, targetAttributes, model, allowedIncludes) {
  const result = {};

  if (args) {
    Object.keys(args).forEach(function (key) {
      if (~targetAttributes.indexOf(key)) {
        result.where = result.where || {};
        result.where[key] = args[key];
      }

      if (key === 'limit' && args[key]) {
        result.limit = parseInt(args[key], 10);
      }

      if (key === 'offset' && args[key]) {
        result.offset = parseInt(args[key], 10);
      }

      if (key === 'order' && args[key]) {
        if (args[key].indexOf('reverse:') === 0) {
          result.order = [[args[key].substring(8), 'DESC']];
        } else {
          result.order = [[args[key], 'ASC']];
        }
      }

      if (key === 'where' && args[key]) {
        result.where = (0, _replaceWhereOperators.replaceWhereOperators)(args.where);
      }

      if (key === 'include' && args[key]) {
        result.include = (0, _replaceWhereOperators.replaceWhereOperators)(args.include);
        fulfillIncludesWithModels(result.include, model, allowedIncludes);
      }
    });
  }

  return result;
}