import { Db } from 'mongodb';
import { IMongoSchema, MongoRepository } from './repository';

interface UserSchema extends IMongoSchema {
  id: string;
  current_session_playtime: number;
  overall_session_playtime: number;
}

export class UserRepository extends MongoRepository<UserSchema> {
  constructor(db: Db) {
    super(db, 'users');
  }

  async load(userId: string) {
    return this.collection.findOne<UserSchema>({ id: userId });
  }

  async loadTopSession(limit: number) {
    return this.loadTopBy(limit, 'current_session_playtime');
  }

  async loadTopOverall(limit: number) {
    return this.loadTopBy(limit, 'overall_session_playtime');
  }

  async resetSessionTimes() {
    return this.collection.updateMany(
      { current_session_playtime: { $gt: 0 } },
      { $set: { current_session_playtime: 0 } },
    );
  }

  private async loadTopBy(limit: number, key: keyof UserSchema) {
    return this.collection
      .aggregate([{ $match: { [key]: { $gt: 0 } } }, { $sort: { [key]: -1 } }, { $limit: limit }])
      .toArray();
  }
}
