// AUTO GENERATED FILE BY @kalissaac/prisma-typegen
// DO NOT EDIT

export interface User {
  id: number
  email: string
  password: string
  name?: string
  avatarUrl?: string
  dateOfBirth?: Date
  createdAt: Date
  updatedAt: Date
  bio?: string
  location?: string
  posts: Post[]
  likes: Like[]
  comments: Comment[]
  followers: Follows[]
  following: Follows[]
}

export interface Follows {
  id: number
  follower?: User
  followerId?: number
  following?: User
  followingId?: number
}

export interface Post {
  id: number
  content: string
  title?: string
  author: User
  viewCount: number
  shareCount: number
  authorId: number
  likes: Like[]
  comments: Comment[]
  createdAt: Date
}

export interface Like {
  id: number
  user?: User
  userId?: number
  post?: Post
  postId?: number
  createdAt: Date
}

export interface Comment {
  id: number
  content: string
  post: Post
  postId: number
  user?: User
  userId?: number
}

export interface CommentLike {
  id: string
  comment?: Comment
  commentId?: string
  user?: User
  userId?: string
  createdAt: Date
}
