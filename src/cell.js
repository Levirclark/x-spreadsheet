import alphabet from './alphabet';

// B10 => x,y
const expr2xy = (src) => {
  let x = '';
  let y = '';
  for (let i = 0; i < src.length; i += 1) {
    if (src.charAt(i) >= '0' && src.charAt(i) <= '9') {
      y += src.charAt(i);
    } else {
      x += src.charAt(i);
    }
  }
  return [alphabet.indexAt(x), parseInt(y, 10)];
};

const expr2expr = (src, xn, yn) => {
  const [x, y] = expr2xy(src);
  return alphabet.stringAt(x + xn) + (y + yn);
};

// Converting infix expression to a suffix expression
// src: AVERAGE(SUM(A1,A2), B1) + 50 + B20
// return: [A1, A2], SUM[, B1],AVERAGE,50,+,B20,+
const infixExprToSuffixExpr = (src) => {
  const operatorStack = [];
  const stack = [];
  let subStrs = []; // SUM, A1, B2, 50 ...
  let fnArgType = 0; // 1 => , 2 => :
  let fnArgsLen = 1; // A1,A2,A3...
  for (let i = 0; i < src.length; i += 1) {
    const c = src.charAt(i);
    // console.log('c:', c);
    if (c !== ' ') {
      if (c >= 'a' && c <= 'z') {
        subStrs.push(c.toUpperCase());
      } else if ((c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z')) {
        subStrs.push(c);
      } else if (c === '"') {
        i += 1;
        while (src.charAt(i) !== '"') {
          subStrs.push(src.charAt(i));
          i += 1;
        }
        stack.push(`"${subStrs.join('')}`);
        subStrs = [];
      } else {
        if (subStrs.length > 0) {
          stack.push(subStrs.join(''));
        }
        if (c === ')') {
          let c1 = operatorStack.pop();
          if (fnArgType === 2) {
            // fn argument range => A1:B5
            const [ex, ey] = expr2xy(stack.pop());
            const [sx, sy] = expr2xy(stack.pop());
            // console.log('::', sx, sy, ex, ey);
            let rangelen = 0;
            for (let x = sx; x <= ex; x += 1) {
              for (let y = sy; y <= ey; y += 1) {
                stack.push(alphabet.stringAt(x) + y);
                rangelen += 1;
              }
            }
            stack.push([c1, rangelen]);
          } else if (fnArgType === 1) {
            // fn argument => A1,A2,B5
            stack.push([c1, fnArgsLen]);
            fnArgsLen = 1;
          } else {
            // console.log('c1:', c1, fnArgType, operatorStack);
            while (c1 !== '(' && operatorStack.length > 0) {
              stack.push(c1);
              c1 = operatorStack.pop();
            }
          }
          fnArgType = 0;
        } else if (c === ':') {
          fnArgType = 2;
        } else if (c === ',') {
          fnArgType = 1;
          fnArgsLen += 1;
        } else if (c === '(' && subStrs.length > 0) {
          // function
          stack.pop();
          operatorStack.push(subStrs.join(''));
        } else {
          // priority: */ > +-
          if (operatorStack.length > 0 && (c === '+' || c === '-')) {
            const last = operatorStack[operatorStack.length - 1];
            if (last === '*' || last === '/') {
              while (operatorStack.length > 0) {
                stack.push(operatorStack.pop());
              }
            }
          }
          operatorStack.push(c);
        }
        subStrs = [];
      }
    }
  }
  if (subStrs.length > 0) {
    stack.push(subStrs.join(''));
  }
  while (operatorStack.length > 0) {
    stack.push(operatorStack.pop());
  }
  return stack;
};

const evalSubExpr = (subExpr, cellRender) => {
  if (subExpr[0] >= '0' && subExpr[0] <= '9') {
    return Number(subExpr);
  }
  if (subExpr[0] === '"') {
    return subExpr.substring(1);
  }
  const [x, y] = expr2xy(subExpr);
  return cellRender(x, y);
};

// evaluate the suffix expression
// srcStack: <= infixExprToSufixExpr
// formulaMap: {'SUM': {}, ...}
// cellRender: (x, y) => {}
const evalSuffixExpr = (srcStack, formulaMap, cellRender) => {
  const stack = [];
  // console.log(':::::formulaMap:', formulaMap);
  for (let i = 0; i < srcStack.length; i += 1) {
    // console.log(':::>>>', srcStack[i]);
    if (srcStack[i] === '+') {
      const top = stack.pop();
      const bottom = stack.pop();
      // Add if numeric. Concatenate otherwise.
      if (!Number.isNaN(top) && !Number.isNaN(bottom)) {
        stack.push(Number(top) + Number(bottom));
      } else {
        stack.push(bottom + top);
      }
    } else if (srcStack[i] === '-') {
      const top = stack.pop();
      stack.push(stack.pop() - top);
    } else if (srcStack[i] === '*') {
      stack.push(stack.pop() * stack.pop());
    } else if (srcStack[i] === '/') {
      const top = stack.pop();
      stack.push(stack.pop() / top);
    } else if (Array.isArray(srcStack[i])) {
      const [formula, len] = srcStack[i];
      const params = [];
      for (let j = 0; j < len; j += 1) {
        params.push(stack.pop());
      }
      stack.push(formulaMap[formula].render(params));
    } else {
      stack.push(evalSubExpr(srcStack[i], cellRender));
    }
    // console.log('stack:', stack);
  }
  // console.log('::::::', stack);
  return stack[0];
};

const cellRender = (src, formulaMap, getCellText) => {
  const recursiveReferenceCell = searchForRecursiveReferences(src, getCellText, []);
  if(recursiveReferenceCell){
    return "RECURSIVE " + recursiveReferenceCell;
  }
  // console.log(':::::::::::::src:', src);
  if (src[0] === '=') {
    const stack = infixExprToSuffixExpr(src.substring(1));
    // console.log('suffixExpr:', stack);
    if (stack.length <= 0) return src;
    const cb = (x, y) => cellRender(getCellText(x, y - 1), formulaMap, getCellText);
    return evalSuffixExpr(stack, formulaMap, cb);
  }
  return src;
};

//renderStack: The stack produced by the callRender fucntion
//getCellText: Function that fetches a cell's text given an x and y
//cellLine: The list of cells that have led to this one's reference
const searchForRecursiveReferences = (src, getCellText, cellLine) => {
  if(src[0] !== '='){
    return '';
  }
  const srcStack = infixExprToSuffixExpr(src.substring(1));
  for (let i = 0; i < srcStack.length; i += 1) {
    if (!['+', '-', '*', '/'].includes(srcStack[i]) && !Array.isArray(srcStack[i])) {
      //We've found a reference to another cell
      //Let's find out what that cell references
      //Check if it references something from the cellLine
      if(cellLine.includes(srcStack[i])){
        return srcStack[i];
      }
      //Hasn't been seen yet, look further
      cellLine.push(srcStack[i]);
      const [x, y] = expr2xy(srcStack[i]);
      const subSrc = getCellText(x, y - 1);
      let recRef = searchForRecursiveReferences(subSrc, getCellText, cellLine)
      if(recRef){
        return recRef;
      }
      //No recursiveness here, forget this reference
      cellLine.pop();
    }
  }
  return '';
}

export default {
  render: cellRender,
};
export {
  infixExprToSuffixExpr,
  expr2xy,
  expr2expr,
};
