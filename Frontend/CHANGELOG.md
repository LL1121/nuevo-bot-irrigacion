# Change Log

## 2026-01-07
- Login UI now inherits saved theme and dark mode (background, cards, inputs, errors) and keeps the brand-only logo sized up with subtle shadow.
- Added autocomplete hints to login inputs and aligned focus styles with themed tokens.
- Ensured authenticated requests use bearer token headers across chats, messages, and control actions; logout clears client state and disconnects cleanly.
- Replaced legacy login header with brand logo and enlarged logo sizing for better visibility.

## 2026-01-06
- Added login guard flow rendering Login when unauthenticated; simplified hook usage to avoid render/order issues.
- Centered and enlarged sidebar branding asset and updated login branding to match product identity.
- Fixed logout blank-screen issue by reordering guard logic and clearing local state on exit.

## 2026-01-05
- Implemented audio message volume control, file attachments, and consistent auth token handling on message send/pause/activate endpoints.
- Updated axios/socket usage to include bearer tokens on initial data fetches.
