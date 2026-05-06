const {
  sendMessageSchema,
  reactivateSchema,
  phoneParamSchema,
  phoneSchema,
  validate
} = require('../validators/messageValidators');

describe('messageValidators', () => {
  
  describe('sendMessageSchema', () => {
    
    it('debe validar un mensaje correcto', () => {
      const data = {
        telefono: '5491123456789',
        mensaje: 'Hola, este es un mensaje de prueba'
      };
      
      const { error, value } = sendMessageSchema.validate(data);
      
      expect(error).toBeUndefined();
      expect(value.telefono).toBe('5491123456789');
      expect(value.mensaje).toBe('Hola, este es un mensaje de prueba');
      expect(value.operador).toBe('Sistema'); // default value
    });
    
    it('debe rechazar teléfono sin formato 549', () => {
      const data = {
        telefono: '1123456789', // Sin 549
        mensaje: 'Hola'
      };
      
      const { error } = sendMessageSchema.validate(data);
      
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('formato 549');
    });
    
    it('debe rechazar teléfono con menos de 10 dígitos después del 549', () => {
      const data = {
        telefono: '549112345', // Solo 6 dígitos después del 549
        mensaje: 'Hola'
      };
      
      const { error } = sendMessageSchema.validate(data);
      
      expect(error).toBeDefined();
    });
    
    it('debe rechazar mensaje vacío', () => {
      const data = {
        telefono: '5491123456789',
        mensaje: ''
      };
      
      const { error } = sendMessageSchema.validate(data);
      
      expect(error).toBeDefined();
      expect(error.details[0].message).toMatch(/empty|vacío/i);
    });
    
    it('debe rechazar mensaje mayor a 4096 caracteres', () => {
      const data = {
        telefono: '5491123456789',
        mensaje: 'a'.repeat(4097)
      };
      
      const { error } = sendMessageSchema.validate(data);
      
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('4096');
    });
    
    it('debe aceptar mensaje exactamente de 4096 caracteres', () => {
      const data = {
        telefono: '5491123456789',
        mensaje: 'a'.repeat(4096)
      };
      
      const { error } = sendMessageSchema.validate(data);
      
      expect(error).toBeUndefined();
    });
    
    it('debe rechazar si falta el teléfono', () => {
      const data = {
        mensaje: 'Hola'
      };
      
      const { error } = sendMessageSchema.validate(data);
      
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('requerido');
    });
    
    it('debe usar operador personalizado si se proporciona', () => {
      const data = {
        telefono: '5491123456789',
        mensaje: 'Hola',
        operador: 'Juan Pérez'
      };
      
      const { error, value } = sendMessageSchema.validate(data);
      
      expect(error).toBeUndefined();
      expect(value.operador).toBe('Juan Pérez');
    });
  });
  
  describe('reactivateSchema', () => {
    
    it('debe validar template sin parámetros', () => {
      const data = {};
      
      const { error, value } = reactivateSchema.validate(data);
      
      expect(error).toBeUndefined();
      expect(value.templateName).toBe('hello_world'); // default
    });
    
    it('debe validar template con nombre personalizado', () => {
      const data = {
        templateName: 'custom_template'
      };
      
      const { error, value } = reactivateSchema.validate(data);
      
      expect(error).toBeUndefined();
      expect(value.templateName).toBe('custom_template');
    });
    
    it('debe validar código de idioma correcto (es)', () => {
      const data = {
        languageCode: 'es'
      };
      
      const { error, value } = reactivateSchema.validate(data);
      
      expect(error).toBeUndefined();
      expect(value.languageCode).toBe('es');
    });
    
    it('debe validar código de idioma con región (es_AR)', () => {
      const data = {
        languageCode: 'es_AR'
      };
      
      const { error, value } = reactivateSchema.validate(data);
      
      expect(error).toBeUndefined();
      expect(value.languageCode).toBe('es_AR');
    });
    
    it('debe rechazar código de idioma inválido', () => {
      const data = {
        languageCode: 'español' // Inválido
      };
      
      const { error } = reactivateSchema.validate(data);
      
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('inválido');
    });
    
    it('debe validar components con type y parameters', () => {
      const data = {
        templateName: 'greeting',
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: 'Juan'
              }
            ]
          }
        ]
      };
      
      const { error } = reactivateSchema.validate(data);
      
      expect(error).toBeUndefined();
    });
    
    it('debe rechazar component con type inválido', () => {
      const data = {
        components: [
          {
            type: 'invalid_type',
            parameters: []
          }
        ]
      };
      
      const { error } = reactivateSchema.validate(data);
      
      expect(error).toBeDefined();
    });
  });
  
  describe('phoneParamSchema', () => {
    
    it('debe validar teléfono con 549 y 10 dígitos', () => {
      const data = {
        telefono: '5491123456789'
      };
      
      const { error } = phoneParamSchema.validate(data);
      
      expect(error).toBeUndefined();
    });
    
    it('debe validar teléfono sin 549 pero con 10+ dígitos', () => {
      const data = {
        telefono: '541123456789' // Formato internacional sin el 9
      };
      
      const { error } = phoneParamSchema.validate(data);
      
      expect(error).toBeUndefined();
    });
    
    it('debe rechazar teléfono con formato inválido', () => {
      const data = {
        telefono: '123'
      };
      
      const { error } = phoneParamSchema.validate(data);
      
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('inválido');
    });
    
    it('debe rechazar si falta el teléfono', () => {
      const data = {};
      
      const { error } = phoneParamSchema.validate(data);
      
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('requerido');
    });
  });
  
  describe('phoneSchema', () => {
    
    it('debe validar phone con formato correcto', () => {
      const data = {
        phone: '5491123456789'
      };
      
      const { error } = phoneSchema.validate(data);
      
      expect(error).toBeUndefined();
    });
  });
  
  describe('validate middleware', () => {
    
    it('debe llamar next() si validación es correcta', () => {
      const req = {
        body: {
          telefono: '5491123456789',
          mensaje: 'Hola'
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();
      
      const middleware = validate(sendMessageSchema, 'body');
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    it('debe retornar 400 si validación falla', () => {
      const req = {
        body: {
          telefono: 'invalid',
          mensaje: ''
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();
      
      const middleware = validate(sendMessageSchema, 'body');
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
      
      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(false);
      expect(response.error).toBe('Validación fallida');
      expect(response.details).toBeInstanceOf(Array);
      expect(response.details.length).toBeGreaterThan(0);
    });
    
    it('debe sanitizar y reemplazar req[property] con valores validados', () => {
      const req = {
        body: {
          telefono: '5491123456789',
          mensaje: 'Hola',
          extraField: 'esto debe ser removido' // stripUnknown: true
        }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();
      
      const middleware = validate(sendMessageSchema, 'body');
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(req.body.extraField).toBeUndefined(); // Removido por stripUnknown
      expect(req.body.operador).toBe('Sistema'); // Default value aplicado
    });
  });
  
});
