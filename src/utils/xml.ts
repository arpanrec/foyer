import { ENTITY_ACTION, EntityDecoder, XML } from "@nodable/entities";
import { XMLParser } from "fast-xml-parser";
import { SyntaxValidator } from "fast-xml-validator";

// An element of a compact document: its attributes under `_attributes`, text under `_text`, CDATA under `_cdata`,
// and each child element under its own name. A name, text or CDATA that occurs more than once becomes an array.
export type XmlCompactNode = {
    _attributes?: Record<string, string>;
    _text?: string | string[];
    _cdata?: string | string[];
    [child: string]: unknown;
};

// What the parser returns with preserveOrder: a list of one-key objects, each holding that element's children
type OrderedNode = Record<string, unknown>;

const ATTRIBUTES_KEY = ":@";
const TEXT_KEY = "#text";
const CDATA_KEY = "_cdata";

// Decodes the five XML entities and numeric references like &#39;. Entities a DOCTYPE defines are never expanded,
// so a hostile document cannot multiply its own size.
const entityDecoder = new EntityDecoder({
    namedEntities: { ...XML },
    numericAllowed: true,
    onInputEntity: () => ENTITY_ACTION.BLOCK,
});

const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: "",
    cdataPropName: CDATA_KEY,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    ignoreDeclaration: true,
    ignorePiTags: true,
    processEntities: true,
    entityDecoder,
});

function addValue(node: XmlCompactNode, key: string, value: unknown) {
    const existing = node[key];
    if (existing === undefined) node[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else node[key] = [existing, value];
}

function isOrderedList(value: unknown): value is OrderedNode[] {
    return Array.isArray(value);
}

function textOf(children: OrderedNode[]): string {
    return children.map((child) => String(child[TEXT_KEY] ?? "")).join("");
}

function convert(children: OrderedNode[]): XmlCompactNode {
    const node: XmlCompactNode = {};

    for (const child of children) {
        for (const [key, value] of Object.entries(child)) {
            if (key === ATTRIBUTES_KEY) continue;

            if (key === TEXT_KEY) {
                // whitespace between elements is not content
                const text = String(value);
                if (text.trim()) addValue(node, "_text", text);
            } else if (key === CDATA_KEY) {
                const text = isOrderedList(value) ? textOf(value) : "";
                if (text) addValue(node, "_cdata", text);
            } else {
                const element = convert(isOrderedList(value) ? value : []);
                const attributes = child[ATTRIBUTES_KEY];
                if (attributes && typeof attributes === "object") {
                    element._attributes = attributes as Record<string, string>;
                }
                addValue(node, key, element);
            }
        }
    }

    return node;
}

// Parses XML into plain objects keyed by element name. Every value is text, so numbers stay strings.
// An empty string gives an empty document, and a document that is not well-formed throws.
export function xmlToCompact(xml: string): Record<string, XmlCompactNode> {
    if (!xml.trim()) return {};

    try {
        SyntaxValidator.validate(xml);
    } catch (error) {
        throw new Error(`Invalid XML: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }

    return convert(parser.parse(xml) as OrderedNode[]) as Record<string, XmlCompactNode>;
}
