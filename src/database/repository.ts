import { MongoClient, Db, Collection } from 'mongodb';

export async function connect(
  url = 'mongodb://document:password@localhost:27017',
  dbName = 'db',
  options = {},
) {
  const client = await MongoClient.connect(url, {
    ...options,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  return client.db(dbName);
}

export interface IMongoSchema {
  _id: string;
}

export class MongoRepository<T extends IMongoSchema> {
  db: Db;
  collection: Collection<T>;

  constructor(db: Db, collectionName: string) {
    this.db = db;
    this.collection = this.db.collection<T>(collectionName);
  }

  dropCollection() {
    return this.db.dropCollection(this.collection.collectionName);
  }

  async create(document: Omit<T, '_id'>) {
    await this.collection.insertOne(document as any);
    return document;
  }

  async update(document: T) {
    return this.collection.updateOne(
      { _id: document._id } as any,
      { $set: document } as any,
      { upsert: true } as any,
    );
  }

  async findByField<key extends keyof T>(field: key, value: T[key]) {
    return await this.collection.findOne({ [field as any]: value });
  }

  async addToField(document: T, field: keyof T, value: T[keyof T]) {
    return await this.collection.updateOne(
      { _id: document._id } as any,
      { $addToSet: { [field]: value } } as any,
    );
  }

  async removeFromField(document: T, field: keyof T, value: T[keyof T]) {
    return await this.collection.updateOne(
      { _id: document._id } as any,
      { $pull: { [field]: value } } as any,
    );
  }
}
