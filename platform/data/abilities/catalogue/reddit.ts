import {
  createAuxiliaryTemplate,
  createFetchTemplate,
  createPackTemplate,
  field,
  secret,
} from '@/lib/ability.template'
import { getRandomUserAgent } from '@/lib/ua'

import type {
  POST_GALLERY_CREATE_HANDLER_NAME,
  POST_IMAGE_CREATE_HANDLER_NAME,
  POST_VIDEO_CREATE_HANDLER_NAME,
  PostGalleryCreateSchema,
  PostImageCreateSchema,
  PostVideoCreateSchema,
} from '@/pages/api/auxiliary/skillset/ability/reddit/post'

const USER_AGENT = getRandomUserAgent()

const POST_API_PATH = '/api/auxiliary/skillset/ability/reddit/post'

// @note common enums for Reddit RSS feeds
const SORT_OPTIONS = ['new', 'hot', 'top', 'rising', 'controversial'] as const
const TIME_OPTIONS = ['hour', 'day', 'week', 'month', 'year', 'all'] as const
const SEARCH_SORT_OPTIONS = [
  'relevance',
  'new',
  'hot',
  'top',
  'comments',
] as const

const abilities = {
  // --- Site-wide front page ---

  'reddit/feed/front/get': createFetchTemplate({
    provider: 'reddit',
    icon: '@logo/reddit.com',
    name: 'Get Reddit Front Page Feed',
    description: 'Get the front page feed from Reddit.',
    tags: ['reddit', 'feed', 'front', 'rss'],
    instruction: {
      method: 'GET',
      url: 'https://www.reddit.com/.rss',
      headers: {
        'User-Agent': USER_AGENT,
      },
      options: {
        format: 'toon',
      },
    },
  }),

  // --- Subreddit feed (supports single, multiple via +, popular, and all) ---

  'reddit/feed/sub/get': createFetchTemplate({
    provider: 'reddit',
    icon: '@logo/reddit.com',
    name: 'Get Reddit Subreddit Feed',
    description:
      'Get the feed for subreddits. Use "popular" for trending, "all" for everything, or specific names. For multiple, separate with + (e.g., programming+javascript).',
    tags: ['reddit', 'feed', 'subreddit', 'popular', 'all', 'multi', 'rss'],
    instruction: {
      method: 'GET',
      url: 'https://www.reddit.com',
      path: [
        '/r/',
        field({
          name: 'subreddit',
          description:
            'subreddit name(s) without r/ - use "popular" for trending, "all" for everything, or specific names with + for multiple (e.g., programming+javascript)',
          placeholder: true,
        }),
        '/',
        field({
          name: 'sort',
          description: 'sort order for posts',
          optional: true,
          default: 'hot',
          enum: [...SORT_OPTIONS],
        }),
        '/.rss',
      ],
      query: {
        t: field({
          name: 'time',
          description: 'time range for top/controversial posts',
          optional: true,
          enum: [...TIME_OPTIONS],
        }),
      },
      headers: {
        'User-Agent': USER_AGENT,
      },
      options: {
        format: 'toon',
      },
    },
  }),

  // --- Domain feeds ---

  'reddit/feed/domain/get': createFetchTemplate({
    provider: 'reddit',
    icon: '@logo/reddit.com',
    name: 'Get Reddit Domain Feed',
    description: 'Get the feed for submissions linking to a specific domain.',
    tags: ['reddit', 'feed', 'domain', 'rss'],
    instruction: {
      method: 'GET',
      url: 'https://www.reddit.com',
      path: [
        '/domain/',
        field({
          name: 'domain',
          description: 'the domain name (e.g., github.com)',
          placeholder: true,
        }),
        '/.rss',
      ],
      headers: {
        'User-Agent': USER_AGENT,
      },
      options: {
        format: 'toon',
      },
    },
  }),

  // --- Post comments feed ---

  'reddit/feed/post/comment/list': createFetchTemplate({
    provider: 'reddit',
    icon: '@logo/reddit.com',
    name: 'List Reddit Post Comments',
    description: 'Get the comments feed for a specific Reddit post.',
    tags: ['reddit', 'feed', 'post', 'comments', 'rss'],
    instruction: {
      method: 'GET',
      url: 'https://www.reddit.com',
      path: [
        '/r/',
        field({
          name: 'subreddit',
          description: 'the subreddit name without r/',
          placeholder: true,
        }),
        '/comments/',
        field({
          name: 'postId',
          description: 'the post ID',
          placeholder: true,
        }),
        '/.rss',
      ],
      headers: {
        'User-Agent': USER_AGENT,
      },
      options: {
        format: 'toon',
      },
    },
  }),

  // --- User comment feed ---

  'reddit/feed/user/comment/list': createFetchTemplate({
    provider: 'reddit',
    icon: '@logo/reddit.com',
    name: 'List Reddit User Comments',
    description: 'List the comments of a user on Reddit.',
    tags: ['reddit', 'feed', 'user', 'comments', 'list', 'rss'],
    instruction: {
      method: 'GET',
      url: 'https://www.reddit.com',
      path: [
        '/user/',
        field({
          name: 'username',
          description: 'the username',
          placeholder: true,
        }),
        '/comments/.rss',
      ],
      headers: {
        'User-Agent': USER_AGENT,
      },
      options: {
        format: 'toon',
      },
    },
  }),

  // --- User feeds (consolidated with feedType enum) ---

  'reddit/feed/user/get': createFetchTemplate({
    provider: 'reddit',
    icon: '@logo/reddit.com',
    name: 'Get Reddit User Feed',
    description:
      'Get a feed for a Reddit user. Use feedType: empty for overview (all activity), "submitted" for posts, or "comments" for comments only.',
    tags: [
      'reddit',
      'feed',
      'user',
      'overview',
      'submitted',
      'comments',
      'rss',
    ],
    instruction: {
      method: 'GET',
      url: 'https://www.reddit.com',
      path: [
        '/user/',
        field({
          name: 'username',
          description: 'the Reddit username',
          placeholder: true,
        }),
        '/',
        field({
          name: 'feedType',
          description:
            'the feed type: leave empty for overview (all activity), or use "submitted" for posts, "comments" for comments only',
          optional: true,
          enum: ['submitted', 'comments'],
        }),
        '/.rss',
      ],
      headers: {
        'User-Agent': USER_AGENT,
      },
      options: {
        format: 'toon',
      },
    },
  }),

  // --- Search (with optional subreddit restriction) ---

  'reddit/feed/search': createFetchTemplate({
    provider: 'reddit',
    icon: '@logo/reddit.com',
    name: 'Search Reddit',
    description:
      'Search Reddit for posts matching a query. Use subreddit "all" for global search, or specify a subreddit name to restrict.',
    tags: ['reddit', 'search', 'feed', 'rss'],
    instruction: {
      method: 'GET',
      url: 'https://www.reddit.com',
      path: [
        '/r/',
        field({
          name: 'subreddit',
          description:
            'subreddit to search within - use "all" for global search or a specific subreddit name',
          default: 'all',
        }),
        '/search.rss',
      ],
      query: {
        q: field({
          name: 'query',
          description: 'the search query',
          placeholder: true,
        }),
        restrict_sr: field({
          name: 'restrictToSubreddit',
          description:
            'set to "on" to restrict to the specified subreddit (recommended when not using "all")',
          optional: true,
          enum: ['on'],
        }),
        sort: field({
          name: 'sort',
          description: 'sort order for search results',
          optional: true,
          default: 'relevance',
          enum: [...SEARCH_SORT_OPTIONS],
        }),
        t: field({
          name: 'time',
          description: 'time range for results',
          optional: true,
          enum: [...TIME_OPTIONS],
        }),
      },
      headers: {
        'User-Agent': USER_AGENT,
      },
      options: {
        format: 'toon',
      },
    },
  }),

  // --- Legacy API endpoint (kept for backwards compatibility) ---

  'reddit/user/comments/list': createFetchTemplate({
    provider: 'reddit',
    icon: '@logo/reddit.com',
    name: 'List Reddit User Comments (API)',
    description: 'List the comments of a user on Reddit via API.',
    tags: ['reddit', 'user', 'comments', 'list', 'api'],
    secret: '@platform/reddit',
    instruction: {
      method: 'POST',
      url: 'https://www.reddit.com',
      path: [
        '/api/v1/user/',
        field({
          name: 'username',
          description: 'the username',
          placeholder: true,
        }),
        '/comments',
      ],
      headers: {
        Authorization: secret(),
      },
    },
  }),

  'reddit/api/call': createFetchTemplate({
    provider: 'reddit',
    icon: '@logo/reddit.com',
    name: 'Call Reddit API',
    description:
      'Make a generic API call to Reddit. This is a flexible template that can be used to call any Reddit API endpoint by specifying the method, URL, and request body.',
    tags: ['reddit', 'api', 'call', 'generic'],
    secret: '@platform/reddit',
    instruction: {
      method: field({
        name: 'method',
        description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
      }),
      url: field({
        name: 'url',
        description: 'The full URL of the Reddit API endpoint to call',
      }),
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/json',
      },
      body: field({
        name: 'body',
        description:
          'the request body as JSON text for POST, PUT, or PATCH requests',
        optional: true,
      }),
    },
  }),

  // --- Post creation (requires OAuth) ---

  'reddit/post/create': createFetchTemplate({
    provider: 'reddit',
    icon: '@logo/reddit.com',
    name: 'Create Reddit Post',
    description:
      'Submit a new post to a subreddit. Supports text posts (self) and link posts (link). Requires Reddit OAuth authentication.',
    tags: ['reddit', 'post', 'create', 'submit'],
    secret: '@platform/reddit',
    instruction: {
      method: 'POST',
      url: 'https://oauth.reddit.com/api/submit',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: {
        sr: field({
          name: 'subreddit',
          description: 'the subreddit name without r/',
          placeholder: true,
        }),
        kind: field({
          name: 'kind',
          description:
            'post type: "self" for a text post, "link" for a link post',
          enum: ['self', 'link'],
        }),
        title: field({
          name: 'title',
          description: 'the post title',
          placeholder: true,
        }),
        text: field({
          name: 'text',
          description: 'the post body in Markdown (for text posts)',
          optional: true,
        }),
        url: field({
          name: 'url',
          description: 'the URL to submit (for link posts)',
          optional: true,
        }),
        nsfw: field({
          name: 'nsfw',
          type: 'boolean',
          description: 'whether to mark the post as NSFW',
          optional: true,
          default: false,
        }),
        spoiler: field({
          name: 'spoiler',
          type: 'boolean',
          description: 'whether to mark the post as a spoiler',
          optional: true,
          default: false,
        }),
      },
    },
  }),

  // --- Image post creation (requires OAuth) ---

  'reddit/post/image/create': createAuxiliaryTemplate<PostImageCreateSchema>({
    provider: 'reddit',
    icon: '@logo/reddit.com',
    name: 'Create Reddit Image Post',
    description:
      'Submit a new image post to a subreddit. Provide the image as a URL and it will be uploaded to Reddit automatically. Requires Reddit OAuth authentication.',
    tags: ['reddit', 'post', 'create', 'submit', 'image'],
    path: POST_API_PATH,
    handler: 'post/image/create' satisfies typeof POST_IMAGE_CREATE_HANDLER_NAME,
    secret: '@platform/reddit',
    instruction: {
      subreddit: field({
        name: 'subreddit',
        description: 'the subreddit name without r/',
        placeholder: true,
      }),
      title: field({
        name: 'title',
        description: 'the post title',
        placeholder: true,
      }),
      imageUrl: field({
        name: 'imageUrl',
        description: 'the URL of the image to upload and submit',
        placeholder: true,
      }),
      nsfw: field({
        name: 'nsfw',
        type: 'boolean',
        description: 'whether to mark the post as NSFW',
        optional: true,
        default: false,
      }),
      spoiler: field({
        name: 'spoiler',
        type: 'boolean',
        description: 'whether to mark the post as a spoiler',
        optional: true,
        default: false,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  'reddit/post/gallery/create':
    createAuxiliaryTemplate<PostGalleryCreateSchema>({
      provider: 'reddit',
      icon: '@logo/reddit.com',
      name: 'Create Reddit Gallery Post',
      description:
        'Submit a new gallery post (2-20 images) to a subreddit. Provide the images as URLs and they will be uploaded to Reddit automatically. Requires Reddit OAuth authentication.',
      tags: ['reddit', 'post', 'create', 'submit', 'image', 'gallery'],
      path: POST_API_PATH,
      handler:
        'post/gallery/create' satisfies typeof POST_GALLERY_CREATE_HANDLER_NAME,
      secret: '@platform/reddit',
      instruction: {
        subreddit: field({
          name: 'subreddit',
          description: 'the subreddit name without r/',
          placeholder: true,
        }),
        title: field({
          name: 'title',
          description: 'the post title',
          placeholder: true,
        }),
        imageUrls: field({
          name: 'imageUrls',
          description:
            'a space separated list of 2 to 20 image URLs to upload and submit as a gallery',
          placeholder: true,
        }),
        nsfw: field({
          name: 'nsfw',
          type: 'boolean',
          description: 'whether to mark the post as NSFW',
          optional: true,
          default: false,
        }),
        spoiler: field({
          name: 'spoiler',
          type: 'boolean',
          description: 'whether to mark the post as a spoiler',
          optional: true,
          default: false,
        }),
      },
      options: {
        auth: 'internal',
      },
    }),

  'reddit/post/video/create': createAuxiliaryTemplate<PostVideoCreateSchema>({
    provider: 'reddit',
    icon: '@logo/reddit.com',
    name: 'Create Reddit Video Post',
    description:
      'Submit a new video post to a subreddit. Provide the video and a poster (thumbnail) image as URLs and they will be uploaded to Reddit automatically. Requires Reddit OAuth authentication.',
    tags: ['reddit', 'post', 'create', 'submit', 'video'],
    path: POST_API_PATH,
    handler: 'post/video/create' satisfies typeof POST_VIDEO_CREATE_HANDLER_NAME,
    secret: '@platform/reddit',
    instruction: {
      subreddit: field({
        name: 'subreddit',
        description: 'the subreddit name without r/',
        placeholder: true,
      }),
      title: field({
        name: 'title',
        description: 'the post title',
        placeholder: true,
      }),
      videoUrl: field({
        name: 'videoUrl',
        description: 'the URL of the video to upload and submit',
        placeholder: true,
      }),
      posterImageUrl: field({
        name: 'posterImageUrl',
        description:
          'the URL of the poster (thumbnail) image shown before the video plays',
        placeholder: true,
      }),
      nsfw: field({
        name: 'nsfw',
        type: 'boolean',
        description: 'whether to mark the post as NSFW',
        optional: true,
        default: false,
      }),
      spoiler: field({
        name: 'spoiler',
        type: 'boolean',
        description: 'whether to mark the post as a spoiler',
        optional: true,
        default: false,
      }),
    },
    options: {
      auth: 'internal',
    },
  }),

  // --- Comment creation (requires OAuth) ---

  'reddit/comment/create': createFetchTemplate({
    provider: 'reddit',
    icon: '@logo/reddit.com',
    name: 'Create Reddit Comment',
    description:
      'Post a comment on a Reddit post or reply to an existing comment. Use a "t3_" prefixed ID to comment on a post or a "t1_" prefixed ID to reply to a comment. Requires Reddit OAuth authentication.',
    tags: ['reddit', 'comment', 'create'],
    secret: '@platform/reddit',
    instruction: {
      method: 'POST',
      url: 'https://oauth.reddit.com/api/comment',
      headers: {
        Authorization: secret(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: {
        parent: field({
          name: 'parent',
          description:
            'full name of the parent - use t3_<postId> to comment on a post or t1_<commentId> to reply to a comment',
          placeholder: true,
        }),
        text: field({
          name: 'text',
          description: 'the comment body in Markdown',
          placeholder: true,
        }),
      },
    },
  }),

  // --- Packs ---

  'pack/reddit': createPackTemplate({
    provider: 'reddit',
    icon: '@logo/reddit.com',
    name: 'Install Reddit Tools',
    description:
      'Installs Reddit tools into the conversation. You can browse feeds, search, create text, link, image, gallery and video posts, and post comments.',
    tags: ['reddit', 'pack', 'beta'],
    secret: '@platform/reddit',
    instruction: {
      abilities: [
        'reddit/feed/sub/get',
        'reddit/feed/search',
        'reddit/feed/post/comment/list',
        'reddit/post/create',
        'reddit/post/image/create',
        'reddit/post/gallery/create',
        'reddit/post/video/create',
        'reddit/comment/create',
      ] satisfies (keyof typeof abilities)[],
    },
  }),

  'pack/reddit[read-only]': createPackTemplate({
    provider: 'reddit',
    icon: '@logo/reddit.com',
    name: 'Install Reddit Browse Tools',
    description:
      'Installs read-only Reddit browsing tools into the conversation. You can browse feeds and search without posting.',
    tags: ['reddit', 'pack', 'beta'],
    instruction: {
      abilities: [
        'reddit/feed/front/get',
        'reddit/feed/sub/get',
        'reddit/feed/domain/get',
        'reddit/feed/post/comment/list',
        'reddit/feed/user/comment/list',
        'reddit/feed/user/get',
        'reddit/feed/search',
      ] satisfies (keyof typeof abilities)[],
    },
  }),
}

export default abilities
