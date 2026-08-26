// Reference lists exist so forms can populate their selects. Only the fields a
// picker needs are exposed — never timestamps or relation internals.

export interface SafeDesignation {
  id: string;
  name: string;
}

export interface SafeRole {
  id: string;
  name: string;
  description: string | null;
}
