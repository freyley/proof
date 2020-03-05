<template>
  <v-app id="covid19riskapp">
    <v-app-bar fixed app>
      <v-toolbar-title>COVID19risk spatiotemporal heatmap demo</v-toolbar-title>
    </v-app-bar>
    <v-content>
      <v-container>
        <nuxt />
      </v-container>
    </v-content>
    <v-footer fixed app class="font-italic font-weight-light">
      <span>&copy; {{ new Date().getFullYear() }} Mikhail Voloshin, Mighty Data Inc. All rights reserved.</span>
      <span>Part of the COVID19risk project.</span>
    </v-footer>
  </v-app>
</template>

<style scoped lang="scss">
#covid19riskapp {

}
</style>

<script>
export default {
}
</script>
