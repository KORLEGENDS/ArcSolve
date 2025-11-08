declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
  export = classes;
}

declare module '*.module.scss' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
  export = classes;
}

declare module '*.module.sass' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
  export = classes;
}
