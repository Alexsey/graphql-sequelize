import * as typeMapper from './typeMapper';
import JSONType from './types/jsonType';
import _ from 'lodash';

module.exports = function (Model) {
  var result = {}
    , key = Model.primaryKeyAttribute
    , scopedAttributes = _.get(Model, '_scope.attributes')
    , isKeyAllowed = scopedAttributes ? _.includes(scopedAttributes, key) : true
    , attribute = isKeyAllowed && Model.rawAttributes[key]
    , type;

  if (attribute) {
    type = typeMapper.toGraphQL(attribute.type, Model.sequelize.constructor);
    result[key] = {
      type: type
    };
  }

  result.where = {
    type: JSONType,
    description: 'A JSON object conforming the the shape specified in http://docs.sequelizejs.com/en/latest/docs/querying/'
  };

  result.include = {
    type: JSONType
  };

  return result;
};
