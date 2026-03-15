/**
 * Config plugin Expo : ajoute l'extension widget "Ma Journée" (WidgetKit)
 *
 * - Ajoute l'App Group au main app entitlements
 * - Copie les fichiers Swift du widget dans ios/MaJourneeWidget/
 * - Crée le target app_extension dans le projet Xcode
 * - Configure les build settings, embed phase et target dependency
 */
const { withXcodeProject, withEntitlementsPlist } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const WIDGET_NAME = 'MaJourneeWidget';
const APP_GROUP_ID = 'group.com.familyvault.dev';

module.exports = function withMaJourneeWidget(config) {
  const bundleId = `${config.ios?.bundleIdentifier}.${WIDGET_NAME}`;
  const teamId = config.ios?.appleTeamId || 'AKMNXGVVGX';

  // 1. Ajouter l'App Group aux entitlements de l'app principale
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults['com.apple.security.application-groups'] = [APP_GROUP_ID];
    return mod;
  });

  // 2. Modifier le projet Xcode pour ajouter le target widget
  config = withXcodeProject(config, (mod) => {
    const proj = mod.modResults;
    const root = mod.modRequest.platformProjectRoot;

    // 2a. Copier les fichiers sources du widget
    const src = path.resolve(__dirname, '..', 'widgets', 'MaJournee');
    const dest = path.join(root, WIDGET_NAME);
    copyRecursive(src, dest);

    // 2b. Ajouter le target app_extension
    const target = proj.addTarget(WIDGET_NAME, 'app_extension', WIDGET_NAME);

    // 2c. Créer un PBXGroup pour les fichiers widget
    const groupKey = proj.pbxCreateGroup(WIDGET_NAME, WIDGET_NAME);
    const mainGroup = proj.getFirstProject().firstProject.mainGroup;
    proj.getPBXGroupByKey(mainGroup).children.push({
      value: groupKey,
      comment: WIDGET_NAME,
    });

    // 2d. Ajouter les fichiers sources au target (manuellement pour éviter l'ajout au main target)
    addFileToTarget(proj, target, groupKey, 'MaJourneeWidget.swift', 'sourcecode.swift', 'Sources');
    addFileToTarget(proj, target, groupKey, 'JournalBebeWidget.swift', 'sourcecode.swift', 'Sources');
    addFileToTarget(proj, target, groupKey, 'FamilyVaultWidgets.swift', 'sourcecode.swift', 'Sources');

    // 2e. Ajouter Assets.xcassets comme folder reference au target
    addFileToTarget(proj, target, groupKey, 'Assets.xcassets', 'folder.assetcatalog', 'Resources');

    // 2f. Configurer les build settings du widget
    const configs = proj.pbxXCBuildConfigurationSection();
    for (const key in configs) {
      const bc = configs[key];
      if (typeof bc !== 'object' || !bc.buildSettings) continue;
      const pn = bc.buildSettings.PRODUCT_NAME;
      if (pn !== `"${WIDGET_NAME}"` && pn !== WIDGET_NAME) continue;

      Object.assign(bc.buildSettings, {
        PRODUCT_BUNDLE_IDENTIFIER: `"${bundleId}"`,
        DEVELOPMENT_TEAM: `"${teamId}"`,
        SWIFT_VERSION: '"5.0"',
        TARGETED_DEVICE_FAMILY: '"1,2"',
        IPHONEOS_DEPLOYMENT_TARGET: '"16.0"',
        CODE_SIGN_ENTITLEMENTS: `"${WIDGET_NAME}/${WIDGET_NAME}.entitlements"`,
        INFOPLIST_FILE: `"${WIDGET_NAME}/Info.plist"`,
        CODE_SIGN_STYLE: '"Automatic"',
        GENERATE_INFOPLIST_FILE: 'YES',
        MARKETING_VERSION: '"1.0.0"',
        CURRENT_PROJECT_VERSION: '"1"',
        SWIFT_EMIT_LOC_STRINGS: 'YES',
        ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: '"AccentColor"',
        ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME: '"WidgetBackground"',
      });
    }

    // 2g. Embed App Extensions build phase sur le main target
    addEmbedExtensionPhase(proj, target);

    // 2h. Dépendance : main target dépend du widget
    addTargetDependency(proj, target);

    // 2i. Ajouter le widget au scheme pour forcer sa compilation
    const schemePath = path.join(
      root, 'FamilyFlow.xcodeproj', 'xcshareddata', 'xcschemes', 'FamilyFlow.xcscheme',
    );
    if (fs.existsSync(schemePath)) {
      let scheme = fs.readFileSync(schemePath, 'utf8');
      const widgetEntry = `
         <BuildActionEntry
            buildForTesting = "YES"
            buildForRunning = "YES"
            buildForProfiling = "YES"
            buildForArchiving = "YES"
            buildForAnalyzing = "YES">
            <BuildableReference
               BuildableIdentifier = "primary"
               BlueprintIdentifier = "${target.uuid}"
               BuildableName = "${WIDGET_NAME}.appex"
               BlueprintName = "${WIDGET_NAME}"
               ReferencedContainer = "container:FamilyFlow.xcodeproj">
            </BuildableReference>
         </BuildActionEntry>`;
      scheme = scheme.replace(
        '</BuildActionEntries>',
        `${widgetEntry}\n      </BuildActionEntries>`,
      );
      fs.writeFileSync(schemePath, scheme);
    }

    return mod;
  });

  return config;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addEmbedExtensionPhase(proj, widgetTarget) {
  const objects = proj.hash.project.objects;

  // Trouver le .appex product reference créé par addTarget
  let appexFileRef = null;
  const fileRefs = objects['PBXFileReference'];
  for (const key in fileRefs) {
    if (typeof fileRefs[key] === 'string') continue;
    if (fileRefs[key].path === `${WIDGET_NAME}.appex`) {
      appexFileRef = key;
      break;
    }
  }
  if (!appexFileRef) return;

  // PBXBuildFile pour le .appex
  const buildFileUuid = proj.generateUuid();
  objects['PBXBuildFile'][buildFileUuid] = {
    isa: 'PBXBuildFile',
    fileRef: appexFileRef,
    fileRef_comment: `${WIDGET_NAME}.appex`,
    settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] },
  };
  objects['PBXBuildFile'][`${buildFileUuid}_comment`] =
    `${WIDGET_NAME}.appex in Embed App Extensions`;

  // PBXCopyFilesBuildPhase (dstSubfolderSpec 13 = PlugIns)
  const embedUuid = proj.generateUuid();
  if (!objects['PBXCopyFilesBuildPhase']) objects['PBXCopyFilesBuildPhase'] = {};
  objects['PBXCopyFilesBuildPhase'][embedUuid] = {
    isa: 'PBXCopyFilesBuildPhase',
    buildActionMask: 2147483647,
    dstPath: '""',
    dstSubfolderSpec: 13,
    files: [
      { value: buildFileUuid, comment: `${WIDGET_NAME}.appex in Embed App Extensions` },
    ],
    name: '"Embed App Extensions"',
    runOnlyForDeploymentPostprocessing: 0,
  };
  objects['PBXCopyFilesBuildPhase'][`${embedUuid}_comment`] = 'Embed App Extensions';

  // Ajouter aux build phases du main target
  const mainTarget = proj.getFirstTarget();
  const mainTargetObj = objects['PBXNativeTarget'][mainTarget.uuid];
  mainTargetObj.buildPhases.push({
    value: embedUuid,
    comment: 'Embed App Extensions',
  });
}

function addTargetDependency(proj, widgetTarget) {
  const objects = proj.hash.project.objects;
  const projectUuid = proj.getFirstProject().uuid;

  // PBXContainerItemProxy
  const proxyUuid = proj.generateUuid();
  if (!objects['PBXContainerItemProxy']) objects['PBXContainerItemProxy'] = {};
  objects['PBXContainerItemProxy'][proxyUuid] = {
    isa: 'PBXContainerItemProxy',
    containerPortal: projectUuid,
    containerPortal_comment: 'Project object',
    proxyType: 1,
    remoteGlobalIDString: widgetTarget.uuid,
    remoteInfo: `"${WIDGET_NAME}"`,
  };
  objects['PBXContainerItemProxy'][`${proxyUuid}_comment`] = 'PBXContainerItemProxy';

  // PBXTargetDependency
  const depUuid = proj.generateUuid();
  if (!objects['PBXTargetDependency']) objects['PBXTargetDependency'] = {};
  objects['PBXTargetDependency'][depUuid] = {
    isa: 'PBXTargetDependency',
    target: widgetTarget.uuid,
    target_comment: WIDGET_NAME,
    targetProxy: proxyUuid,
    targetProxy_comment: 'PBXContainerItemProxy',
  };
  objects['PBXTargetDependency'][`${depUuid}_comment`] = 'PBXTargetDependency';

  // Ajouter la dépendance au main target
  const mainTarget = proj.getFirstTarget();
  const mainTargetObj = objects['PBXNativeTarget'][mainTarget.uuid];
  if (!mainTargetObj.dependencies) mainTargetObj.dependencies = [];
  mainTargetObj.dependencies.push({
    value: depUuid,
    comment: 'PBXTargetDependency',
  });
}

/**
 * Ajoute un fichier UNIQUEMENT au widget target (pas au main target).
 * phaseType: 'Sources' pour .swift, 'Resources' pour .xcassets
 */
function addFileToTarget(proj, target, groupKey, fileName, fileType, phaseType) {
  const objects = proj.hash.project.objects;

  // PBXFileReference
  const fileRefUuid = proj.generateUuid();
  objects['PBXFileReference'][fileRefUuid] = {
    isa: 'PBXFileReference',
    lastKnownFileType: fileType,
    path: fileName,
    sourceTree: '"<group>"',
  };
  objects['PBXFileReference'][`${fileRefUuid}_comment`] = fileName;

  // Ajouter au group
  const group = objects['PBXGroup'][groupKey];
  if (group) {
    group.children.push({ value: fileRefUuid, comment: fileName });
  }

  // PBXBuildFile
  const buildFileUuid = proj.generateUuid();
  objects['PBXBuildFile'][buildFileUuid] = {
    isa: 'PBXBuildFile',
    fileRef: fileRefUuid,
    fileRef_comment: fileName,
  };
  objects['PBXBuildFile'][`${buildFileUuid}_comment`] = `${fileName} in ${phaseType}`;

  // Ajouter à la build phase correspondante du widget target
  const nativeTarget = objects['PBXNativeTarget'][target.uuid];
  const phaseSection = phaseType === 'Sources'
    ? 'PBXSourcesBuildPhase'
    : 'PBXResourcesBuildPhase';

  for (const phase of nativeTarget.buildPhases) {
    const buildPhase = objects[phaseSection]?.[phase.value];
    if (buildPhase) {
      buildPhase.files.push({
        value: buildFileUuid,
        comment: `${fileName} in ${phaseType}`,
      });
      break;
    }
  }
}

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    entry.isDirectory() ? copyRecursive(s, d) : fs.copyFileSync(s, d);
  }
}
