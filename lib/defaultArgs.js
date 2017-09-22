'use strict';

var _typeMapper = require('./typeMapper');

var typeMapper = _interopRequireWildcard(_typeMapper);

var _jsonType = require('./types/jsonType');

var _jsonType2 = _interopRequireDefault(_jsonType);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

module.exports = function (Model) {
  var result = {},
      key = Model.primaryKeyAttribute,
      scopedAttributes = _lodash2.default.get(Model, '_scope.attributes'),
      isKeyAllowed = scopedAttributes ? _lodash2.default.includes(scopedAttributes, key) : true,
      attribute = isKeyAllowed && Model.rawAttributes[key],
      type;

  if (attribute) {
    type = typeMapper.toGraphQL(attribute.type, Model.sequelize.constructor);
    result[key] = {
      type: type
    };
  }

  result.where = {
    type: _jsonType2.default,
    description: 'A JSON object conforming the the shape specified in http://docs.sequelizejs.com/en/latest/docs/querying/'
  };

  result.include = {
    type: _jsonType2.default
  };

  return result;
};