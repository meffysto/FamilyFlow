/**
 * Config plugin: retire l'entitlement Push Notifications du build iOS.
 * Nécessaire pour les Apple ID gratuits (Personal Team) qui ne supportent pas
 * cette capability.
 */
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function removePushEntitlement(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
};
