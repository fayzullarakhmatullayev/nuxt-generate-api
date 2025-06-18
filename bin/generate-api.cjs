#!/usr/bin/env node
// generate-api.cjs

const fs = require('fs');
const path = require('path');

// Check for local swagger file
const LOCAL_SWAGGER_FILE = './swagger.json';

function generateTypes(components, paths) {
  let types = `// Generated TypeScript types for BNR API
// Generated at: ${new Date().toISOString()}

`;

  // Generate schema interfaces
  if (components.schemas) {
    Object.entries(components.schemas).forEach(([name, schema]) => {
      types += generateInterface(name, schema, components.schemas);
    });
  }

  // Generate request/response types for each endpoint
  const endpointTypes = generateEndpointTypes(paths, components);
  types += endpointTypes;

  return types;
}

function generateInterface(name, schema, allSchemas, indent = '') {
  // Handle enums directly
  if (schema.enum && schema.type === 'string') {
    let comment = '';
    if (schema.description) {
      comment =
        schema.description
          .split('\n')
          .map((line) => `${indent}// ${line.trim()}`)
          .join('\n') + '\n';
    }

    const enumType = schema.enum.map((v) => `'${v}'`).join(' | ');
    return `${comment}${indent}export type ${name} = ${enumType}\n\n`;
  }

  // Default object interface
  let interfaceStr = `${indent}export interface ${name} {\n`;

  if (schema.properties) {
    Object.entries(schema.properties).forEach(([prop, propSchema]) => {
      const optional = schema.required && schema.required.includes(prop) ? '' : '?';
      const type = getTypeFromSchema(propSchema, allSchemas);

      let comment = '';
      if (propSchema.description) {
        const lines = propSchema.description.split('\n');
        comment = lines.map((line) => `${indent}  // ${line}`).join('\n') + '\n';
      }

      interfaceStr += `${comment}${indent}  ${prop}${optional}: ${type}\n`;
    });
  }

  interfaceStr += `${indent}}\n\n`;
  return interfaceStr;
}

function generateEndpointTypes(paths, components) {
  let types = '// Endpoint-specific types\n';

  Object.entries(paths).forEach(([endpoint, methods]) => {
    Object.entries(methods).forEach(([method, spec]) => {
      const operationId = spec.operationId || generateOperationId(method, endpoint);
      const typeName = pascalCase(operationId);

      // Generate request type
      const requestType = generateRequestType(spec, typeName);
      if (requestType) {
        types += requestType;
      }

      // Generate response type
      const responseType = generateResponseType(spec, typeName, components);
      if (responseType) {
        types += responseType;
      }
    });
  });

  return types;
}
function formatMultilineComment(description, indent = '    ') {
  return description
    .split(/\r?\n/)
    .map((line) => `${indent}// ${line.trim()}`)
    .join('\n');
}

function generateRequestType(spec, typeName) {
  const pathParams = spec.parameters?.filter((p) => p.in === 'path') || [];
  const queryParams = spec.parameters?.filter((p) => p.in === 'query') || [];
  const hasBody = !!spec.requestBody;

  if (pathParams.length === 0 && queryParams.length === 0 && !hasBody) {
    return '';
  }

  let requestType = `export interface ${typeName}Request {\n`;

  // Path parameters
  pathParams.forEach((param) => {
    const type = getTypeFromSchema(param.schema);
    const comment = param.description ? formatMultilineComment(param.description, '  ') + '\n' : '';
    requestType += `${comment}  ${param.name}: ${type}\n`;
  });

  // Query parameters
  if (queryParams.length > 0) {
    requestType += `  query?: {\n`;
    queryParams.forEach((param) => {
      const type = getTypeFromSchema(param.schema);
      const optional = param.required ? '' : '?';
      const comment = param.description
        ? formatMultilineComment(param.description, '    ') + '\n'
        : '';
      requestType += `${comment}    ${param.name}${optional}: ${type}\n`;
    });
    requestType += `  }\n`;
  }

  // Request body
  if (hasBody) {
    const bodyType = getRequestBodyType(spec.requestBody);
    requestType += `  body: ${bodyType}\n`;
  }

  requestType += `}\n\n`;
  return requestType;
}

function generateResponseType(spec, typeName, components) {
  if (!spec.responses || !spec.responses['200']) {
    return `export type ${typeName}Response = any\n\n`;
  }

  const responseSchema = spec.responses['200'].content?.['application/json']?.schema;
  if (!responseSchema) {
    return `export type ${typeName}Response = any\n\n`;
  }

  const responseType = getTypeFromSchema(responseSchema, components.schemas);
  return `export type ${typeName}Response = ${responseType}\n\n`;
}

// Generate composables/useApiService.ts
const useApiServiceContent = `// Generated utility composable for BNR API

type Methods =
  | "GET"
  | "HEAD"
  | "PATCH"
  | "POST"
  | "PUT"
  | "DELETE"
  | "CONNECT"
  | "OPTIONS"
  | "TRACE"
  | "get"
  | "head"
  | "patch"
  | "post"
  | "put"
  | "delete"
  | "connect"
  | "options"
  | "trace";

export async function useApiService<T>(
  url: string,
  options: {
    method?: Methods;
    query?: Record<string, any>;
    body?: any;
    headers?: HeadersInit;
    baseURL?: string;
    parseResponse?: boolean;
  } = {}
): Promise<T> {
  const config = useRuntimeConfig();

  const {
    method = "GET",
    query,
    body,
    headers = {},
    baseURL = config.public.apiUrl as string,
    parseResponse = true
  } = options;

  try {
    const result = await $fetch<T>(url, {
      baseURL,
      method,
      query,
      body,
      headers
    });

    return parseResponse ? result : (result as unknown as T);
  } catch (err: any) {
    console.error(\`[❌ useFetch] \${method} \${url}\`, err);
    throw err;
  }
}
`;

function generateComposable(paths) {
  let composableContent = `// Generated API composables for BNR API
// Generated from: Local swagger.json file
// Generated at: ${new Date().toISOString()}

import type * as ApiTypes from '../types/api.types'

export const useApi = () => {
  const config = useRuntimeConfig()
  const baseURL = config.public.apiUrl || 'https://bnr.dx.unicon.uz'

`;

  const functions = [];

  Object.entries(paths).forEach(([endpoint, methods]) => {
    Object.entries(methods).forEach(([method, spec]) => {
      const operationId = spec.operationId || generateOperationId(method, endpoint);
      const functionName = camelCase(operationId);
      const typeName = pascalCase(operationId);

      const { params, pathParams, hasQuery, hasBody } = analyzeFunctionParams(spec);
      const fetchCall = generateTypedFetchCall(
        endpoint,
        method,
        pathParams,
        hasQuery,
        hasBody,
        typeName
      );

      composableContent += `  // ${
        spec.summary ||
        spec.description
          ?.split('\n')
          ?.map((line) => line.trim())
          ?.join(' ') ||
        `${method.toUpperCase()} ${endpoint}`
      }
  const ${functionName} = async (${params}): Promise<ApiTypes.${typeName}Response> => {
    ${fetchCall}
  }

`;
      functions.push(functionName);
    });
  });

  composableContent += `  return {
    ${functions.join(',\n    ')}
  }
}
`;

  return composableContent;
}

function analyzeFunctionParams(spec) {
  const pathParams = spec.parameters?.filter((p) => p.in === 'path') || [];
  const queryParams = spec.parameters?.filter((p) => p.in === 'query') || [];
  const hasBody = !!spec.requestBody;
  const hasQuery = queryParams.length > 0;

  const operationId = spec.operationId || 'Operation';
  const typeName = pascalCase(operationId);

  if (pathParams.length === 0 && !hasQuery && !hasBody) {
    return { params: '', pathParams, hasQuery, hasBody };
  }

  return {
    params: `params: ApiTypes.${typeName}Request`,
    pathParams,
    hasQuery,
    hasBody
  };
}

function generateTypedFetchCall(endpoint, method, pathParams, hasQuery, hasBody, typeName) {
  const pathWithParams =
    pathParams.length > 0 ? endpoint.replace(/\{([^}]+)\}/g, '${params.$1}') : endpoint;

  let fetchCall = `return await useApiService<ApiTypes.${typeName}Response>(\`${pathWithParams}\`, {\n      baseURL,\n      method: '${method.toUpperCase()}'`;

  if (hasQuery) {
    fetchCall += ',\n      query: params.query';
  }

  if (hasBody) {
    fetchCall += ',\n      body: params.body';
  }

  fetchCall += '\n    })';

  return fetchCall;
}

function getRequestBodyType(requestBody) {
  if (!requestBody.content) return 'any';

  const jsonContent = requestBody.content['application/json'];
  if (!jsonContent || !jsonContent.schema) return 'any';

  return getTypeFromSchema(jsonContent.schema);
}

function generateOperationId(method, endpoint) {
  const cleanPath = endpoint.replace(/\{[^}]+\}/g, 'By').replace(/[^a-zA-Z0-9]/g, '');

  return `${method}${cleanPath}`;
}

function getTypeFromSchema(schema, allSchemas = {}) {
  if (!schema) return 'any';

  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop();
    return refName;
  }

  // Handle allOf (resolve first matching type)
  if (schema.allOf && schema.allOf.length > 0) {
    const resolved = schema.allOf[0];
    return getTypeFromSchema(resolved, allSchemas);
  }

  switch (schema.type) {
    case 'string':
      if (schema.enum) {
        return schema.enum.map((v) => `'${v}'`).join(' | ');
      }
      if (schema.format === 'date-time') return 'string';
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return `${getTypeFromSchema(schema.items, allSchemas)}[]`;
    case 'object':
      if (schema.properties) {
        const props = Object.entries(schema.properties)
          .map(([key, prop]) => {
            const optional = schema.required && schema.required.includes(key) ? '' : '?';
            return `${key}${optional}: ${getTypeFromSchema(prop, allSchemas)}`;
          })
          .join(', ');
        return `{ ${props} }`;
      }
      return 'Record<string, any>';
    default:
      return 'any';
  }
}

function camelCase(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');
}

function pascalCase(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase())
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');
}

// Main function
function main() {
  try {
    if (!fs.existsSync(LOCAL_SWAGGER_FILE)) {
      console.error(`❌ ${LOCAL_SWAGGER_FILE} not found!`);
      console.log('\n💡 How to get the swagger.json file:');
      console.log('1. Visit https://your-api-url/api/swagger/ in your browser');
      console.log('2. Open browser developer tools (F12)');
      console.log('3. Go to Network tab');
      console.log('4. Refresh the page');
      console.log('5. Look for requests ending in .json (often schema.json or openapi.json)');
      console.log('6. Right-click the JSON response and "Save as" swagger.json');
      console.log('7. Place the file in this directory and run the script again');
      process.exit(1);
    }

    console.log('📖 Reading local swagger.json file...');
    const swaggerContent = fs.readFileSync(LOCAL_SWAGGER_FILE, 'utf8');
    const swaggerSpec = JSON.parse(swaggerContent);

    console.log(`📋 Found ${Object.keys(swaggerSpec.paths || {}).length} endpoints`);

    // Generate the composable
    const composableContent = generateComposable(
      swaggerSpec.paths || {},
      swaggerSpec.components || {}
    );

    // Write to file
    const outputDir = './composables';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(path.join(outputDir, 'useApi.ts'), composableContent);

    const typesOutput = generateTypes(swaggerSpec.components || {}, swaggerSpec.paths || {});
    const typesDir = './types';
    if (!fs.existsSync(typesDir)) {
      fs.mkdirSync(typesDir, { recursive: true });
    }
    fs.writeFileSync(path.join(typesDir, 'api.types.ts'), typesOutput);

    fs.writeFileSync(path.join(outputDir, 'useApiService.ts'), useApiServiceContent);

    console.log(
      '✅ API service composable generated successfully at ./composables/useApiService.ts'
    );
    console.log('✅ API types generated successfully at ./types/api.types.ts');
    console.log('✅ API composable generated successfully at ./composables/useApi.ts');
  } catch (error) {
    console.error('❌ Error generating API:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();
