import WidgetKit
import SwiftUI

@main
struct FamilyVaultWidgets: WidgetBundle {
    var body: some Widget {
        MaJourneeWidget()
        JournalBebeWidget()
        if #available(iOS 16.2, *) {
            FeedingLiveActivity()
            MascotteLiveActivity()
        }
    }
}
