<template>
  <v-app>

    <v-app-bar fixed app>
      <v-toolbar-title>
        SimContagion
      </v-toolbar-title>
      <v-spacer />
      <v-btn icon>
        <v-icon>mdi-tune</v-icon>
      </v-btn>
    </v-app-bar>

    <v-content>
      <v-container>
        <nuxt />
      </v-container>
    </v-content>

  </v-app>
</template>

<script>
export default {
}
</script>
