// AUTO GENERATED FILE BY @kalissaac/prisma-typegen
// DO NOT EDIT




export interface User {
    id: number,
    email: string,
    password: string,
    name?: string,
    avatarUrl?: string,
    dateOfBirth?: Date,
    createdAt: Date,
    updatedAt: Date,
    bio?: string,
    location?: string,
    posts: Post[],
    likes: Like[],
    comments: Comment[],
    followers: Follows[],
    following: Follows[],
}

export interface Follows {
    id: number,
    follower?: User,
    followerId?: number,
    following?: User,
    followingId?: number,
}

export interface Post {
    id: number,
    content: string,
    title?: string,
    author: User,
    authorId: number,
    likes: Like[],
    comments: Comment[],
    createdAt: Date,
}

export interface Like {
    id: number,
    User?: User,
    userId?: number,
    Post?: Post,
    postId?: number,
}

export interface Comment {
    id: number,
    content: string,
    post: Post,
    postId: number,
    User?: User,
    userId?: number,
}
