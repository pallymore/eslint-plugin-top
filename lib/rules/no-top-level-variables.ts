// SPDX-License-Identifier: ISC

import type {Rule} from 'eslint';
import type {
  Declaration,
  Expression,
  VariableDeclaration,
  VariableDeclarator
} from 'estree';

import {isTopLevel} from '../helpers';

type Options = {
  readonly constAllowed: ReadonlyArray<string>;
  readonly kind: ReadonlyArray<string>;
};

const violationMessage = 'Variables at the top level are not allowed';

const constAllowedValues = [
  'ArrayExpression',
  'ArrowFunctionExpression',
  'Literal',
  'MemberExpression',
  'ObjectExpression'
];
const kindValues = ['const', 'let', 'var'];

const defaultConstAllowed = ['ArrowFunctionExpression', 'MemberExpression'];
const alwaysConstAllowed = ['Literal'];

function isRequireCall(expression: Expression | null | undefined): boolean {
  return (
    expression?.type === 'CallExpression' &&
    expression.callee.type === 'Identifier' &&
    expression.callee.name === 'require'
  );
}

function isSymbol(expression: Expression): boolean {
  return (
    expression.type === 'CallExpression' &&
    expression.callee.type === 'Identifier' &&
    expression.callee.name === 'Symbol'
  );
}

function checker(
  context: Rule.RuleContext,
  options: Options,
  node: VariableDeclaration
) {
  if (!Array.from(options.kind).includes(node.kind)) {
    return;
  }

  let allowedDeclaration: (declaration: VariableDeclarator) => boolean;
  if (node.kind === 'const') {
    allowedDeclaration = (declaration) => {
      // type-coverage:ignore-next-line
      const expression = declaration.init as Expression;
      const t = expression.type;

      switch (t) {
        case 'CallExpression': {
          // type-coverage:ignore-next-line
          return isRequireCall(expression) || isSymbol(expression);
        }
        case 'Identifier':
          return true;
        default:
          return options.constAllowed.includes(t);
      }
    };
  } else {
    allowedDeclaration = (declaration) => isRequireCall(declaration.init);
  }

  node.declarations
    .filter((declaration) => !allowedDeclaration(declaration))
    .forEach((declaration) => {
      context.report({
        node: declaration,
        messageId: 'message'
      });
    });
}

export const noTopLevelVariables: Rule.RuleModule = {
  meta: {
    type: 'problem',
    messages: {
      message: violationMessage
    },
    schema: [
      {
        type: 'object',
        properties: {
          constAllowed: {
            type: 'array',
            minItems: 0,
            items: {
              enum: constAllowedValues
            }
          },
          kind: {
            type: 'array',
            minItems: 1,
            items: {
              enum: kindValues
            }
          }
        }
      }
    ]
  },
  create: (context) => {
    const options: Options = {
      constAllowed: [
        ...alwaysConstAllowed,
        // type-coverage:ignore-next-line
        ...(context.options[0]?.constAllowed || defaultConstAllowed)
      ],
      // type-coverage:ignore-next-line
      kind: context.options[0]?.kind || kindValues
    };

    return {
      ExportNamedDeclaration: (node) => {
        // type-coverage:ignore-next-line
        const declaration = node.declaration as Declaration;
        if (declaration.type === 'VariableDeclaration') {
          checker(context, options, declaration);
        }
      },
      VariableDeclaration: (node) => {
        if (isTopLevel(node)) {
          checker(context, options, node);
        }
      }
    };
  }
};
