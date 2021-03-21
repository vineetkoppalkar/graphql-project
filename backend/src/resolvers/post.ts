import { Resolver, Query, Arg, Int, Mutation } from 'type-graphql';
import { Post } from '../entities/Post';
@Resolver()
export class PostResolver {
  @Query(() => [Post])
  async posts(): Promise<Post[]> {
    return Post.find();
  }

  @Query(() => Post, { nullable: true })
  post(@Arg('id', () => Int) id: number): Promise<Post | undefined> {
    return Post.findOne(id);
  }

  @Mutation(() => Post)
  async createPost(@Arg('title', () => String) title: string): Promise<Post> {
    console.log(`Post '${title}' has been created!`);
    return Post.create({ title }).save();
  }

  @Mutation(() => Post, { nullable: true })
  async updatePost(
    @Arg('id', () => Int) id: number,
    @Arg('title', () => String, { nullable: true }) title: string
  ): Promise<Post | null> {
    const post = await Post.findOne(id);
    if (!post) {
      return null;
    }

    if (typeof title !== 'undefined') {
      await Post.update({ id }, { title });
      console.log(`Post '${title}' has been updated!`);
    }

    return post;
  }

  @Mutation(() => Boolean)
  async deletePost(@Arg('id', () => Int) id: number): Promise<Boolean> {
    await Post.delete(id);
    console.log(`Post '${id}' has been deleted!`);
    return true;
  }
}
