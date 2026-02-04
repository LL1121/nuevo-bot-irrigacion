/**
 * OpenAPI / Swagger Specification
 * 
 * Este archivo define la especificación de API en formato OpenAPI 3.0
 * Puede ser visualizado con Swagger UI o utilizado para code generation
 */

const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Bot de Irrigación API',
    description: 'API para gestión de sistemas de irrigación inteligentes',
    version: '2.0.0',
    contact: {
      name: 'Support',
      email: 'support@bot-irrigacion.com',
    },
    license: {
      name: 'MIT',
    },
  },
  servers: [
    {
      url: 'https://api.bot-irrigacion.com/v2',
      description: 'Production (v2)',
      variables: {
        basePath: {
          default: 'v2',
        },
      },
    },
    {
      url: 'https://api-staging.bot-irrigacion.com/v2',
      description: 'Staging (v2)',
    },
    {
      url: 'http://localhost:3000/v2',
      description: 'Development',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token',
      },
    },
    schemas: {
      User: {
        type: 'object',
        required: ['id', 'email', 'name', 'role'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'User ID',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email',
          },
          name: {
            type: 'string',
            description: 'User full name',
          },
          role: {
            type: 'string',
            enum: ['admin', 'user', 'viewer'],
            description: 'User role',
          },
          avatar: {
            type: 'string',
            format: 'uri',
            nullable: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      AuthToken: {
        type: 'object',
        required: ['accessToken', 'refreshToken', 'expiresIn', 'tokenType'],
        properties: {
          accessToken: {
            type: 'string',
            description: 'JWT access token',
          },
          refreshToken: {
            type: 'string',
            description: 'JWT refresh token',
          },
          expiresIn: {
            type: 'integer',
            description: 'Token expiration in seconds',
          },
          tokenType: {
            type: 'string',
            enum: ['Bearer'],
          },
        },
      },
      Chat: {
        type: 'object',
        required: ['id', 'userId', 'title', 'createdAt', 'updatedAt'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          userId: {
            type: 'string',
            format: 'uuid',
          },
          title: {
            type: 'string',
            maxLength: 255,
          },
          description: {
            type: 'string',
            nullable: true,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
          stats: {
            type: 'object',
            properties: {
              messageCount: {
                type: 'integer',
                description: 'Total messages in chat',
              },
            },
          },
        },
      },
      Message: {
        type: 'object',
        required: ['id', 'chatId', 'userId', 'content', 'type', 'createdAt'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          chatId: {
            type: 'string',
            format: 'uuid',
          },
          userId: {
            type: 'string',
            format: 'uuid',
          },
          content: {
            type: 'string',
          },
          type: {
            type: 'string',
            enum: ['user', 'assistant'],
          },
          metadata: {
            type: 'object',
            nullable: true,
            properties: {
              model: {
                type: 'string',
              },
              tokens: {
                type: 'integer',
              },
              responseTime: {
                type: 'number',
              },
            },
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          attachments: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Attachment',
            },
          },
        },
      },
      Attachment: {
        type: 'object',
        required: ['id', 'messageId', 'type', 'url', 'mimeType', 'size', 'name'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
          },
          messageId: {
            type: 'string',
            format: 'uuid',
          },
          type: {
            type: 'string',
            enum: ['image', 'file', 'document'],
          },
          url: {
            type: 'string',
            format: 'uri',
          },
          mimeType: {
            type: 'string',
          },
          size: {
            type: 'integer',
            description: 'File size in bytes',
          },
          name: {
            type: 'string',
          },
        },
      },
      ApiResponse: {
        type: 'object',
        required: ['success'],
        properties: {
          success: {
            type: 'boolean',
          },
          data: {
            type: 'object',
            nullable: true,
          },
          error: {
            $ref: '#/components/schemas/ApiError',
          },
          meta: {
            type: 'object',
            properties: {
              timestamp: {
                type: 'string',
                format: 'date-time',
              },
              version: {
                type: 'string',
              },
              requestId: {
                type: 'string',
              },
            },
          },
        },
      },
      ApiError: {
        type: 'object',
        required: ['code', 'message', 'statusCode'],
        properties: {
          code: {
            type: 'string',
            enum: ['INVALID_CREDENTIALS', 'TOKEN_EXPIRED', 'NOT_FOUND', 'UNAUTHORIZED', 'VALIDATION_ERROR'],
          },
          message: {
            type: 'string',
          },
          details: {
            type: 'object',
            nullable: true,
          },
          statusCode: {
            type: 'integer',
          },
        },
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {},
          },
          total: {
            type: 'integer',
          },
          page: {
            type: 'integer',
          },
          pageSize: {
            type: 'integer',
          },
          hasMore: {
            type: 'boolean',
          },
        },
      },
    },
  },
  paths: {
    '/auth/login': {
      post: {
        summary: 'Login user',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: {
                    type: 'string',
                    format: 'email',
                  },
                  password: {
                    type: 'string',
                    minLength: 8,
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      properties: {
                        data: {
                          $ref: '#/components/schemas/AuthToken',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '401': {
            description: 'Invalid credentials',
          },
        },
      },
    },
    '/auth/token': {
      post: {
        summary: 'Refresh access token',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: {
                  refreshToken: {
                    type: 'string',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Token refreshed',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      properties: {
                        data: {
                          $ref: '#/components/schemas/AuthToken',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '401': {
            description: 'Invalid or expired refresh token',
          },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get current user profile',
        tags: ['Authentication'],
        security: [{ BearerAuth: [] }],
        responses: {
          '200': {
            description: 'User profile',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      properties: {
                        data: {
                          $ref: '#/components/schemas/User',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
    },
    '/chats': {
      get: {
        summary: 'Get paginated chats',
        tags: ['Chats'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
          {
            name: 'pageSize',
            in: 'query',
            schema: { type: 'integer', default: 10 },
          },
          {
            name: 'sortBy',
            in: 'query',
            schema: { type: 'string', enum: ['createdAt', 'updatedAt', 'title'], default: 'updatedAt' },
          },
          {
            name: 'order',
            in: 'query',
            schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
        ],
        responses: {
          '200': {
            description: 'Paginated chats',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      properties: {
                        data: {
                          allOf: [
                            { $ref: '#/components/schemas/PaginatedResponse' },
                            {
                              properties: {
                                items: {
                                  type: 'array',
                                  items: {
                                    $ref: '#/components/schemas/Chat',
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
      post: {
        summary: 'Create new chat',
        tags: ['Chats'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title'],
                properties: {
                  title: {
                    type: 'string',
                    maxLength: 255,
                  },
                  description: {
                    type: 'string',
                    nullable: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Chat created',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Chat',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized',
          },
        },
      },
    },
    '/chats/{chatId}': {
      get: {
        summary: 'Get single chat',
        tags: ['Chats'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'chatId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': {
            description: 'Chat details',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Chat',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          '404': {
            description: 'Chat not found',
          },
        },
      },
      delete: {
        summary: 'Delete chat',
        tags: ['Chats'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'chatId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '204': {
            description: 'Chat deleted',
          },
          '404': {
            description: 'Chat not found',
          },
        },
      },
    },
    '/chats/{chatId}/messages': {
      get: {
        summary: 'Get messages from chat',
        tags: ['Messages'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'chatId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1 },
          },
        ],
        responses: {
          '200': {
            description: 'Messages',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      properties: {
                        data: {
                          allOf: [
                            { $ref: '#/components/schemas/PaginatedResponse' },
                            {
                              properties: {
                                items: {
                                  type: 'array',
                                  items: {
                                    $ref: '#/components/schemas/Message',
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Send message to chat',
        tags: ['Messages'],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'chatId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['content'],
                properties: {
                  content: {
                    type: 'string',
                    minLength: 1,
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Message sent',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Message',
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  },
};

export default swaggerSpec;
