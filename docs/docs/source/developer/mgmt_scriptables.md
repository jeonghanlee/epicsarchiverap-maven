# Management Scriptables

The management business-process-layer actions that scripts can call are described in the API reference the build generates from the `BPLServlet` registry and the `@BPLEndpoint` annotation on each action class. The reference ships inside the mgmt web application, so it always matches the deployed code:

- `/mgmt/ui/api/index.html` is the readable reference, one section per action with its HTTP methods and request parameters, in registration order.
- `/mgmt/ui/api/api.json` carries the same data for scripts and tools.

Open either path on a running appliance through the mgmt port, or follow the **Help** link in the mgmt web interface.
