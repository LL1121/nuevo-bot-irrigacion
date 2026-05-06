export type InteractiveOption = {
  id?: string | number;
  title?: string;
  description?: string;
};

export type InteractiveSection = {
  title?: string;
  rows?: InteractiveOption[];
};

export type InteractiveButton = {
  id?: string | number;
  title?: string;
};

export type InteractiveMessagePayload = {
  type?: string;
  header?: string;
  body?: string;
  buttonText?: string;
  sections?: InteractiveSection[];
  buttons?: InteractiveButton[];
};
