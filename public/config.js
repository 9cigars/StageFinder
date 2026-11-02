// Where the response-collecting backend lives.
//  null                            -> no backend (the hosted site): results show locally, nothing is requested
//  ''                              -> same server that serves this page (run `node server.js`)
//  'https://your-api.example.com'  -> a separately hosted backend
window.IIM_API_BASE = null;
