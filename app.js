/**
 * Created by aldo on 5/4/14.
 */
var fortune = require('fortune')
  , express = fortune.express
  , RSVP = fortune.RSVP
  , util = require('util');

var container = express()
  , port = process.argv[2] || 1337;

var app = fortune({
  db: 'fortune-admin',
  adapter: 'mongodb',
  namespace: '/api/v1'
})

.resource("user", {
  title : String,
  firstName : String,
  lastName : String,
  role : String,
  email : String,
  nationality: String,
  languageCode: String,
  addresses: [{ref: "address", inverse: "user"}],
  flights: [{ref: "flight", inverse: "flights", pkType: String}]
}, {
  model: {pk: "email"}
})

.resource("address", {
  type: String,
  addressLine1: String,
  addressLine2: String,
  addressLine3: String,
  addressLine4: String,
  city: String,
  region: String,
  postCode: String,
  country: String,
  dateDeleted: Date,
  user: {ref: "user", inverse: "addresses", pkType: String}
})

.resource("flight", {
  flightNumber: String,
  users: [{ref: "user", inverse: "users", pkType : String}]
}, { model: { pk: "flightNumber" }})


.transform(
//  before
  function () {
    return this;
  },
//  after
  function (request) {
    console.log('Request : ' + util.inspect(request.body));
    if (request.body.addresses) {
      findUser(request.body.addresses[0].user).then(function (user) {
        console.log(user);
        user.addresses.push(this._id);
      });
    }
    return this;
  }
)


container
  .use(express.static(__dirname + '/public/app'))
  .use(express.static(__dirname + '/public/app/scripts'))
  .use(app.router)
  .get('/schema', function(req, res){ res.json( packageSchema() );})
  .listen(port);

console.log('Listening on port ' + port + '...');

/**
 * Find User.
 */
function findUser(id) {
  return new RSVP.Promise(function(resolve, reject) {
    app.adapter.find('user', id).then(function(resource){
      if(!!resource) {
        resolve(resource);
      } else {
        reject(this);
      }
    });
  });
}

function checkRelations(resource, key){
    var ret = [],
        node = app._resources[resource]['schema'][key],
        tmp = {'from': resource};
    for(var n in node){
        if(node[n].hasOwnProperty('ref'))
            ret.push({'from': resource, 'to': node[n]['ref'], 'as': node[n]['inverse']});
        if(n == 'ref')
            tmp['to'] = node[n];
        if(n == 'inverse')
            tmp['as'] = node[n];
    }
    if(tmp.hasOwnProperty('to'))
        ret.push(tmp);
    return ret;
}

function packageSchema(){
    var ret = {};
    var all_relations = [];
    for(var resource in app._resources){
        var pk = app._resources[resource].modelOptions ?
            app._resources[resource].modelOptions['pk'] : 'id'; // id being mongo default
        ret[resource] = { 'schema': [], 
                          'pk': pk,
                          'fks': [],
                          'relations': [] };
        for(var key in app._resources[resource]['schema']){
            ret[resource]['schema'].push(key); // we need only key names: values are usually Function objects
            var rels = checkRelations(resource, key);
            all_relations = all_relations.concat(rels);
        }
    }
    for(var r in all_relations){
        var rel = all_relations[r];
        ret[rel['from']]['relations'].push(rel['to']); // X relates to Y
        ret[rel['to']]['fks'].push(rel['as']); // so Y has foreign key at field related by X
    }
    return ret;
}
