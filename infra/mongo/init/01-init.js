const replicaSetName = "rs0";
const replicaSetHost = "mongodb:27017";

try {
  const hello = db.adminCommand({ hello: 1 });
  if (hello.setName && hello.setName !== replicaSetName) {
    throw new Error(`MongoDB is already configured for replica set ${hello.setName}`);
  }
  if (!hello.setName) {
    const result = db.adminCommand({
      replSetInitiate: {
        _id: replicaSetName,
        members: [{ _id: 0, host: replicaSetHost }]
      }
    });
    if (!result.ok) throw new Error(`Replica-set initialization failed: ${result.errmsg || result.codeName}`);
  }
} catch (error) {
  print(`MongoDB replica-set initialization failed: ${error.message}`);
  quit(1);
}

if (process.env.MONGO_APP_USERNAME && process.env.MONGO_APP_PASSWORD) {
  db.createUser({
    user: process.env.MONGO_APP_USERNAME,
    pwd: process.env.MONGO_APP_PASSWORD,
    roles: [
      { role: "readWrite", db: process.env.MONGO_INITDB_DATABASE || "manager-point" }
    ]
  });
}
