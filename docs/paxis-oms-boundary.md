# Paxis OMS Product Boundary

## Product Roles

Paxis and Patisco are separate products with different centers of gravity.

| Product | Primary purpose | Scope |
| --- | --- | --- |
| Patisco.com | Closed B2B network | Helps each company build and operate its own private B2B trading network |
| Paxis | Internal operations system | Helps one company control products, inventory, orders, fulfillment, shipping, receivables, and marketplace operations |

Patisco can feed Paxis through the existing MCP Server integration, but Patisco is not the parent system for Paxis OMS.

## Source Channels

Paxis should preserve source semantics instead of merging every external order into Patisco-shaped fields.

| Source | Example | Paxis source value |
| --- | --- | --- |
| B2B Network | Patisco MCP / webhook | `PATISCO` |
| Marketplace | Shopee / Ruten / momo / PChome / Coupang | `MARKETPLACE` |
| Internal user | Manual sales order | `MANUAL` |
| File or AI import | PDF / Excel / parsed order | `AI_IMPORT` |

## OMS Direction

The OMS module should live inside Paxis and reuse existing Paxis foundations:

- `PRD_Product` for product identity and SKU matching
- `INV_Stock` for quantity, reserved quantity, and available quantity
- `SLS_Order` for internal sales demand
- `SLS_PI` as the existing reservation mechanism
- `SLS_Shipment` for confirmed outbound shipment and inventory deduction
- Existing UPS shipping code as the first shipping adapter

Marketplace connectors should normalize platform orders into a Paxis marketplace order shape, then import them into existing Paxis fulfillment flow.

## AI Assist Direction

OMS AI Assist should support operators inside Paxis. It should not blur product boundaries.

Initial deterministic recommendations:

- prioritize orders near platform shipping deadline
- flag SKU and inventory shortages
- recommend own-stock, purchase-first, or dropship handling
- group orders by carrier for batch shipment
- identify imported orders and avoid duplicate processing

Future LLM-backed recommendations:

- explain why an order is blocked
- draft supplier replenishment or dropship requests
- summarize platform API errors in plain language
- detect address, SKU, price, and payout anomalies
- recommend next actions across Patisco, marketplace, and manual source channels
