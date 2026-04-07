const Joi = require('joi');

/**
 * Schema para enviar mensaje de texto
 */
const sendMessageSchema = Joi.object({
  telefono: Joi.string()
    .pattern(/^549\d{10}$/)
    .required()
    .messages({
      'string.pattern.base': 'Teléfono debe tener formato 549 + 10 dígitos',
      'any.required': 'El teléfono es requerido'
    }),
  mensaje: Joi.string()
    .min(1)
    .max(4096)
    .required()
    .messages({
      'string.min': 'El mensaje no puede estar vacío',
      'string.max': 'El mensaje no puede exceder 4096 caracteres',
      'any.required': 'El mensaje es requerido'
    }),
  operador: Joi.string()
    .optional()
    .default('Sistema')
});

/**
 * Schema para reactivar conversación con template
 */
const reactivateSchema = Joi.object({
  templateName: Joi.string()
    .min(1)
    .max(512)
    .optional()
    .default('hello_world')
    .messages({
      'string.min': 'El nombre del template no puede estar vacío',
      'string.max': 'El nombre del template es demasiado largo'
    }),
  languageCode: Joi.string()
    .pattern(/^[a-z]{2}(_[A-Z]{2})?$/)
    .optional()
    .messages({
      'string.pattern.base': 'Código de idioma inválido (ej: es, en_US)'
    }),
  components: Joi.array()
    .items(
      Joi.object({
        type: Joi.string()
          .valid('header', 'body', 'button')
          .required(),
        parameters: Joi.array()
          .items(
            Joi.object({
              type: Joi.string()
                .valid('text', 'currency', 'date_time', 'image', 'document', 'video')
                .required(),
              text: Joi.string().when('type', {
                is: 'text',
                then: Joi.required()
              }),
              currency: Joi.object({
                fallback_value: Joi.string().required(),
                code: Joi.string().required(),
                amount_1000: Joi.number().required()
              }).when('type', {
                is: 'currency',
                then: Joi.required()
              }),
              date_time: Joi.object({
                fallback_value: Joi.string().required()
              }).when('type', {
                is: 'date_time',
                then: Joi.required()
              }),
              image: Joi.object({
                link: Joi.string().uri().required()
              }).when('type', {
                is: 'image',
                then: Joi.required()
              }),
              document: Joi.object({
                link: Joi.string().uri().required(),
                filename: Joi.string().optional()
              }).when('type', {
                is: 'document',
                then: Joi.required()
              }),
              video: Joi.object({
                link: Joi.string().uri().required()
              }).when('type', {
                is: 'video',
                then: Joi.required()
              })
            })
          )
          .optional()
      })
    )
    .optional()
});

/**
 * Schema para parámetro de teléfono en URL
 */
const phoneParamSchema = Joi.object({
  telefono: Joi.string()
    .pattern(/^549?\d{10,13}$/)
    .required()
    .messages({
      'string.pattern.base': 'Formato de teléfono inválido',
      'any.required': 'El teléfono es requerido'
    })
});

/**
 * Schema para parámetro phone en URL
 */
const phoneSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^549?\d{10,13}$/)
    .required()
    .messages({
      'string.pattern.base': 'Formato de teléfono inválido',
      'any.required': 'El teléfono es requerido'
    })
});

/**
 * Schema para transferir un chat entre subdelegaciones
 */
const transferTicketSchema = Joi.object({
  subdelegacion_id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'subdelegacion_id debe ser numérico',
      'number.integer': 'subdelegacion_id debe ser entero',
      'number.positive': 'subdelegacion_id debe ser mayor a cero',
      'any.required': 'subdelegacion_id es requerido'
    }),
  motivo: Joi.string()
    .max(250)
    .optional()
    .allow('')
    .messages({
      'string.max': 'motivo no puede exceder 250 caracteres'
    })
});

/**
 * Middleware de validación genérico
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        error: 'Validación fallida',
        details: errors
      });
    }

    // Reemplazar con valores validados y sanitizados
    req[property] = value;
    next();
  };
};

module.exports = {
  sendMessageSchema,
  reactivateSchema,
  transferTicketSchema,
  phoneParamSchema,
  phoneSchema,
  validate
};
