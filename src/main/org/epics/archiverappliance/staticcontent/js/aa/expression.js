// A parser of arithmetic expressions for the derived signals of the analyzer, since the content security policy of the pages
// forbids eval: numbers, named variables, the operators + - * / ^ with the usual precedence (a unary minus applies to the power
// that follows it, so -2^2 is -4 as in mathematics), parentheses, the
// constants pi and e, and the functions abs, sqrt, exp, log (natural), log10, sin, cos, tan, asin, acos, atan, min, max, pow.
// parse(text) returns {ok: true, variables, evaluate} where evaluate takes an object of variable values, or {ok: false, reason}.

const FUNCTIONS = {
    abs: [1, Math.abs], sqrt: [1, Math.sqrt], exp: [1, Math.exp], log: [1, Math.log], log10: [1, Math.log10],
    sin: [1, Math.sin], cos: [1, Math.cos], tan: [1, Math.tan], asin: [1, Math.asin], acos: [1, Math.acos], atan: [1, Math.atan],
    min: [2, Math.min], max: [2, Math.max], pow: [2, Math.pow],
};
const CONSTANTS = { pi: Math.PI, e: Math.E };
const TOKEN = /\s*(?:(\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+(?:[eE][-+]?\d+)?)|([A-Za-z_][A-Za-z0-9_:.]*)|([-+*/^(),]))/y;

/** The tokens of the text, or null with the position of the first character that is not one. */
function tokenize(text) {
    const tokens = [];
    TOKEN.lastIndex = 0;
    let at = 0;
    while (at < text.length) {
        if (/^\s+$/.test(text.slice(at))) break;
        TOKEN.lastIndex = at;
        const match = TOKEN.exec(text);
        if (!match) return { error: at };
        if (match[1] !== undefined) tokens.push({ type: "number", value: Number(match[1]) });
        else if (match[2] !== undefined) tokens.push({ type: "name", value: match[2] });
        else tokens.push({ type: "operator", value: match[3] });
        at = TOKEN.lastIndex;
    }
    return { tokens };
}

/**
 * Parses the expression. The result's evaluate(values) returns the number for the variable values given (NaN when a variable
 * is missing); variables lists the names the expression uses, in order of first use.
 */
export function parse(text) {
    const scanned = tokenize(String(text ?? ""));
    if (scanned.error !== undefined) {
        return { ok: false, reason: `Unexpected character at position ${scanned.error + 1}.` };
    }
    const tokens = scanned.tokens;
    if (!tokens.length) {
        return { ok: false, reason: "The expression is empty." };
    }
    const variables = [];
    let position = 0;
    const peek = () => tokens[position];
    const take = () => tokens[position++];
    const expectOperator = (value) => {
        const token = take();
        if (!token || token.type !== "operator" || token.value !== value) {
            throw new Error(token ? `Expected ${value} but found ${token.value}.` : `Expected ${value} at the end.`);
        }
    };
    function primary() {
        const token = take();
        if (!token) throw new Error("The expression ends where a value is expected.");
        if (token.type === "number") return () => token.value;
        if (token.type === "name") {
            if (peek() && peek().type === "operator" && peek().value === "(") {
                const definition = FUNCTIONS[token.value];
                if (!definition) throw new Error(`Unknown function ${token.value}.`);
                take();
                const args = [expression()];
                while (peek() && peek().type === "operator" && peek().value === ",") { take(); args.push(expression()); }
                expectOperator(")");
                if (args.length !== definition[0]) throw new Error(`${token.value} takes ${definition[0]} argument${definition[0] === 1 ? "" : "s"}.`);
                return (values) => definition[1](...args.map((arg) => arg(values)));
            }
            if (token.value in CONSTANTS) return () => CONSTANTS[token.value];
            if (!variables.includes(token.value)) variables.push(token.value);
            return (values) => (token.value in values ? Number(values[token.value]) : NaN);
        }
        if (token.value === "(") {
            const inner = expression();
            expectOperator(")");
            return inner;
        }
        throw new Error(`Unexpected ${token.value}.`);
    }
    function unary() {
        if (peek() && peek().type === "operator" && peek().value === "-") { take(); const operand = unary(); return (values) => -operand(values); }
        if (peek() && peek().type === "operator" && peek().value === "+") { take(); return unary(); }
        return power();
    }
    function power() {
        const base = primary();
        if (peek() && peek().type === "operator" && peek().value === "^") {
            take();
            const exponent = unary();
            return (values) => base(values) ** exponent(values);
        }
        return base;
    }
    function term() {
        let left = unary();
        while (peek() && peek().type === "operator" && (peek().value === "*" || peek().value === "/")) {
            const operator = take().value;
            const right = unary();
            const previous = left;
            left = operator === "*" ? (values) => previous(values) * right(values) : (values) => previous(values) / right(values);
        }
        return left;
    }
    function expression() {
        let left = term();
        while (peek() && peek().type === "operator" && (peek().value === "+" || peek().value === "-")) {
            const operator = take().value;
            const right = term();
            const previous = left;
            left = operator === "+" ? (values) => previous(values) + right(values) : (values) => previous(values) - right(values);
        }
        return left;
    }
    try {
        const evaluate = expression();
        if (position < tokens.length) {
            return { ok: false, reason: `Unexpected ${tokens[position].value} after the expression.` };
        }
        return { ok: true, variables, evaluate };
    } catch (error) {
        return { ok: false, reason: error.message };
    }
}
