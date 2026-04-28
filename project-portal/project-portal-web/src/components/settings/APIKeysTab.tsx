"use client";

import { useEffect, useState } from "react";
import {
  getAPIKeys,
  createAPIKey,
  deleteAPIKey,
  rotateAPIKey,
} from "@/lib/api/settings";
import { useSettings } from "@/lib/hooks/useSettings";
import { showToast } from "@/components/ui/Toast";
import type { APIKey, APIKeyWithSecret } from "@/lib/api/settings";

export function APIKeysTab() {
  const keysState = useSettings<APIKey[]>();
  const createState = useSettings<APIKeyWithSecret>();
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState<string | null>(null);
  const [newKeyData, setNewKeyData] = useState({
    name: "",
    scopes: [] as string[],
  });

  const allScopes = ["read", "write", "admin", "delete"];

  useEffect(() => {
    loadKeys();
  }, []);

  useEffect(() => {
    if (keysState.data) {
      setKeys(keysState.data);
    }
  }, [keysState.data]);

  const loadKeys = async () => {
    try {
      await keysState.execute(() => getAPIKeys());
    } catch (error) {
      showToast("error", "Failed to load API keys");
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyData.name || newKeyData.scopes.length === 0) {
      showToast("error", "Name and at least one scope are required");
      return;
    }

    try {
      const result = await createState.execute(() =>
        createAPIKey({
          name: newKeyData.name,
          scopes: newKeyData.scopes,
        })
      );

      setShowSecretKey(result.secret_key);
      showToast("success", "API key created successfully");
      setNewKeyData({ name: "", scopes: [] });

      // Add to list
      setKeys((prev) => [...prev, { ...result, secret_key: undefined }]);
    } catch (error) {
      showToast("error", "Failed to create API key");
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to delete this key?")) return;

    try {
      await deleteAPIKey(keyId);
      showToast("success", "API key deleted");
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch (error) {
      showToast("error", "Failed to delete API key");
    }
  };

  const handleRotateKey = async (keyId: string) => {
    if (
      !confirm(
        "Rotating will invalidate the current key. Are you sure?"
      )
    )
      return;

    try {
      const result = await rotateAPIKey(keyId);
      setShowSecretKey(result.secret_key);
      showToast("success", "API key rotated. Copy the new key now.");
      await loadKeys();
    } catch (error) {
      showToast("error", "Failed to rotate API key");
    }
  };

  const handleScopeChange = (scope: string) => {
    setNewKeyData((prev) => ({
      ...prev,
      scopes: prev.scopes.includes(scope)
        ? prev.scopes.filter((s) => s !== scope)
        : [...prev.scopes, scope],
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("success", "Copied to clipboard");
  };

  if (keysState.isLoading && keys.length === 0) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">API Keys</h2>
        <button
          onClick={() => setShowNewKeyModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Create New Key
        </button>
      </div>

      {/* Secret Key Display Modal */}
      {showSecretKey && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Your API Key</h3>
            <p className="text-sm text-gray-600 mb-4">
              Save this key securely. You won't be able to see it again.
            </p>
            <div className="bg-gray-100 p-3 rounded-lg mb-4 break-all font-mono text-sm">
              {showSecretKey}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copyToClipboard(showSecretKey)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Copy
              </button>
              <button
                onClick={() => setShowSecretKey(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Key Modal */}
      {showNewKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Create New API Key</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Key Name
                </label>
                <input
                  type="text"
                  value={newKeyData.name}
                  onChange={(e) =>
                    setNewKeyData((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="e.g., Production API"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scopes
                </label>
                <div className="space-y-2">
                  {allScopes.map((scope) => (
                    <label key={scope} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newKeyData.scopes.includes(scope)}
                        onChange={() => handleScopeChange(scope)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                      />
                      <span className="capitalize">{scope}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleCreateKey}
                disabled={createState.isLoading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {createState.isLoading ? "Creating..." : "Create"}
              </button>
              <button
                onClick={() => {
                  setShowNewKeyModal(false);
                  setNewKeyData({ name: "", scopes: [] });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keys List */}
      {keys.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No API keys yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div
              key={key.id}
              className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium">{key.name}</h4>
                  <p className="text-sm text-gray-600">
                    {key.key_prefix}****{key.key_last_four}
                  </p>
                  <div className="flex gap-2 mt-2">
                    {key.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {key.is_active ? (
                      <span className="text-green-600">Active</span>
                    ) : (
                      <span className="text-red-600">Inactive</span>
                    )}
                    {key.last_used_at && (
                      <span className="ml-2">
                        Last used: {new Date(key.last_used_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRotateKey(key.id)}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Rotate
                  </button>
                  <button
                    onClick={() => handleDeleteKey(key.id)}
                    className="px-3 py-1 text-sm border border-red-300 text-red-700 rounded hover:bg-red-50"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
