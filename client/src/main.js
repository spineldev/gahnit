import Vue from 'vue'
import App from './App.vue'
import { ApolloClient } from 'apollo-client'
import { HttpLink } from 'apollo-link-http'
import { setContext } from 'apollo-link-context'
import { InMemoryCache, IntrospectionFragmentMatcher } from 'apollo-cache-inmemory'
import { WebSocketLink } from 'apollo-link-ws'
import { ApolloLink, split } from 'apollo-link'
import { withClientState } from 'apollo-link-state'
import { getMainDefinition } from 'apollo-utilities'
import VueApollo from 'vue-apollo'
import router from './router'
import { USER_ID, AUTH_TOKEN } from './constants'

// Vue production tip config
Vue.config.productionTip = false

const httpLink = new HttpLink({ uri: `https://${process.env.VUE_APP_GAHNIT_SERVER}` })

const middlewareLink = new ApolloLink((operation, forward) => {
  // get the authentication token from local storage if it exists
  const token = localStorage.getItem(AUTH_TOKEN)
  // return the headers to the context so httpLink can read them
  operation.setContext({
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    }
  })
  return forward(operation)
})

// Authenticated httplink
const httpLinkAuth = middlewareLink.concat(httpLink)

const wsLink = new WebSocketLink({
  uri: `wss://${process.env.VUE_APP_GAHNIT_SERVER}`,
  options: {
    reconnect: true,
    connectionParams: {
      Authorization: `Bearer ${localStorage.getItem(AUTH_TOKEN)}`
    }
  }
})

const link = split(
  // split based on operation type
  ({ query }) => {
    const { kind, operation } = getMainDefinition(query)
    return kind === 'OperationDefinition' && operation === 'subscription'
  },
  wsLink,
  httpLinkAuth,
)

const introspectionQueryResultData = require('./fragmentTypes.json');
const fragmentMatcher = new IntrospectionFragmentMatcher({
    introspectionQueryResultData
});

// apollo client setup
const client = new ApolloClient({
  link: ApolloLink.from([link]),
  cache: new InMemoryCache({ fragmentMatcher }),
  connectToDevTools: true,
  onError: (e) => { console.log(e) }
})

// Install the vue plugin
Vue.use(VueApollo)

// Apollo provider init
const apolloProvider = new VueApollo({
  defaultClient: client
})

// get user authentication token saved after login
let token = localStorage.getItem(AUTH_TOKEN)

router.beforeEach((to, from, next) => {
  // Look at all routes
  router.options.routes.forEach((route) => {
    // If this is the current route and it's secure
    if (to.matched[0].path === route.path && route.secure) {
      // Verify that the user isn't logged in
      if(!token || token === '' || token === null){
        // Route back to the landing
        return next('/login');
      }
    }
    if (to.matched[0].path === route.path && route.unAuth) {
      // Verify that the user isn't logged in
      if(token){
        // Route back to the landing
        return next('/');
      }
    }
  });
  // Proceed as normal
  next();
});

// Start the app
new Vue({
  el: '#app',
  provide: apolloProvider.provide(),
  router,
  data: {
    token
  },
  render: h => h(App)
}).$mount('#app')
