

# 142-dependencies-and-constraints

Dependencies and Constraints
What Are Dependencies?
Dependencies ensure items in your timeline are placed in a logical and consistent order, by specifying items that rely on other items to be completed. This is most commonly associated with Project Management, where such prerequisites are commonplace (e.g. the electrical wiring cannot commence until the house is made watertight), but they can be applied to many different scenarios across project management, fiction, and legal industries. Dependencies can also be shown in item cards.
We use the terms
Blocks
and
Blocked by
to designate the relationship between two dependent events: when “Event B” is
blocked
by “Event A”, this means that Event B cannot start until Event A has finished (see dependency types below for slight variations on this). In this scenario, we also say that “Event A”
blocks
“Event B”, and when you look at the Item Inspector, you will see lists for both
Blocks
and
Blocked by
dependencies.
Importantly, dependencies specify an order of events, but they do not specify an exact timing: when Event B is blocked by Event A, we know that  B should follow A, but that does not mean that B should immediately follow A. For more advanced scenarios, including those that specify an exact timing, you should use Constraints instead.
What are Constraints?
Constraints are a more advanced option that provides more flexibility in specifying time-based constraints for items. These include constraints that directly affect the allowed timing of items by tying them to a specific date or offset from another event.
With constraints, the user is able to specify combinations of options, including whether:
the start or end date of the item is affected;
the comparison is against a fixed date (e.g. A > 2012), relative to another item (e.g. A > B), or matches only part of a date (e.g. A occurs on a Monday);
an exact or relational comparison is used (e.g. A=B, A>B, A>=B, A<B, A<=B, etc.);
an offset should be applied to the calculation (e.g. A = B + 9 months)
Note that this offers more flexibility than Aeon Timeline version 2.x, where this differentiation between simple dependencies and flexible constraints didn’t exist, and all dependencies implied an exact date (i.e. an
equals
comparison).
Configuring Dependencies
Creating Dependencies
To configure dependencies for an item, switch to the
Dependencies and Constraints
tab in the Inspector, and modify the
Blocks and Blocked by
lists under the
Timeline Dependencies
heading.
To make the selected item dependent on another, click on the add icon (
) alongside the
Blocked by
list and choose the second item from the ensuing dropdown. Likewise, to make another item depend on the currently selected item, click on the + icon alongside the Blocks list instead.
Make Dependent Shortcut
You can quickly add dependencies between multiple selected events by choosing
Make Dependent
underneath the Timeline menu.This menu will only be enabled when  multiple events are selected.
With two events selected, a new dependency will be created so that the later event is Blocked by the earlier event. If more than two events are selected, a chain of dependencies will be created such that the second event is dependent on the first, the third is dependent on the second, and so on.
Editing Dependency Type
Newly created dependencies will default to the
Finish to Start
dependency type as this will be appropriate in most circumstances.
To select a different dependency type, click on the down arrow (
) next to the dependency. This allows you to choose between the following four dependency types:
Finish to Start: Event B’s start date must be later than or equal to Event A’s end date.
Finish to Finish: Event B’s end date must be later than or equal to Event A’s end date.
Start to Start: Event B’s start date must be later than or equal to Event A’s start date.
Start to Finish: Event B’s end date must be later than or equal to Event A’s start date.
Deleting Dependencies
To delete an existing dependency, click on the delete icon (
) alongside the item in the inspector. Alternatively, you can choose
Remove Dependencies
from the
Item menu
to remove all dependencies associated with the selected items.
Configuring Constraints
You can also create constraints in the
Dependencies and Constraints
tab in the inspector. Under the heading ‘Date Constraints’, click the add icon (
) to create a new constraint.
There are a number of different configuration options to choose from when creating a constraint for a particular item in your timeline. These are as follows:
Date-based constraints
Start is after date
Start is before date
Start equals date
End is after date
End is before date
End equals date
Item-based constraints
Start is after start of an item
Start is before start of an item
Start equals start of an item
Start is after end of an item
Start is before end of an item
Start equals end of an item
End is after start of an item
End is before start of an item
End equals start of an item
End is after end of an item
End is before end of an item
End equals end of an item
You can specify additional offsets for item-based constraints to add additional time between the affected items. This can be used when two events must occur with a fixed interval between them (e.g. a contract expires 12 months after it is initially signed).
Violated Constraints and Dependencies
A dependency or a constraint is violated when the dates of the relevant items do not match the specified criteria. These violations can occur when you first configure a constraint or dependency (if the conditions are not already met when first created), or any time you make a change that affects an item’s dates. How violations are handled depends on whether you choose for constraints to be resolved manually or automatically (see below).
If violations are not resolved automatically, they are collated into the dependency panel that is accessible via the Sidebar. This panel shows all of the items with violated dependencies in a single location. The number of violated dependencies and constraints are shown in a badge on the sidebar icon (
).
Violated items are also visible on both the Timeline View and Spreadsheet View. The inspector will also highlight any violated dependencies or constraints for the selected item.
Resolving Violations
You can choose whether Aeon Timeline attempts to automatically resolve violated dependencies and constraints by changing the Automatic Date Adjustment setting in the Settings Modal (see Settings Modal link).
With this value set to Resolve constraints and adjust children, any time a constraint has been violated, Aeon Timeline will attempt to move the affected items until all dependencies and constraints are satisfied once more. Alternatively, any other setting will allow you to manually control how and when violated constraints are resolved.
Constraints will always be resolved by moving dates, never by adjusting durations.
Manual Resolution
Manual resolution provides you with the most control over how a violation will be resolved. When you notice a violated dependency or constraint, you can resolve it manually by modifying the dates of affected items, or alternatively, modifying or removing the constraint if it should no longer apply. There may be certain violations where it is impossible to satisfy all criteria, such as when dependency loops have been formed (e.g. A < B and B < A).
When there is a violation, a red status icon (
) will appear next to the constraint. Clicking on the ‘Resolve’ button below the constraint will provide available options to resolve the constraint, including moving an affected item or removing the constraint altogether.
Semi-manual Resolution
As violations grow in number and complexity, it may become difficult to resolve them all manually, as each item you move may in turn violate another dependency.
The Resolve All button at the top of the Constraints Panel is useful when there are a lot of violations in your timeline, as this will attempt to resolve all constraints at once. This is a semi-manual process as you are able to choose exactly when you want to perform an action, and can immediately undo the action if you do not like the result.
Depending on the volume of constraints and their complexity, this may lead to significant changes to items throughout your timeline. It is better to resolve constraints frequently, as this will lead to fewer changes and make it easier to see which items have been moved.
As described in more detail below under Automatic Live Resolution, a further setting called Dependency and Constraint Adjustment Limits can be used to set any limits on when items can be moved backwards in time. This setting applies to both automatic and manual resolution.
Note: as constraint resolution is a complicated process, there may be certain constraint combinations that the system is unable to resolve, and which you will need to resolve manually.
Automatic Live Resolution
With Automatic Date Adjustment set to include Resolve constraints, the system will attempt to automatically resolve violations created by your actions as soon as they occur. This option is turned on by default in certain templates such as Project Management, but it can be adjusted in the Settings at any time.
Where possible, automatic resolution will always try to retain the most recent change you have made, and instead move other items to satisfy the constraints.
Using the example of A blocks B:
If A takes than expected and you add another 6 months to A’s duration, B will have its start date adjusted to occur after the new end date for Item A.
Conversely, if you instead moved B forward to start before A ends, the system would compensate by moving the start date for A backwards in time to allow this change to occur.
In real-world project management situations, it will not be suitable to automatically move items back in time to historic or near-term dates (no matter how much you may sometimes wish you could!) To guard against this, an additional setting is provided in the Settings modal that allows you to determine when items are allowed to be moved backwards in time.
This setting is Dependency and Constraint Adjustment Limits, and can be set to have either no limit (the default value for fiction templates, where anything goes), or to prevent shifting items earlier than today, tomorrow, next week, or next month.
With these values set, you will still be able to manually move items to earlier dates, but the built-in Resolve options will not move an item backwards if its final start date will occur before the limit you have selected.

# 148-what-are-relative-dates

What Are Relative Dates
When planning your story, you might not want to have to think about the exact dates that your events happen. You might know that your story is vaguely set in a certain time period, but the exact dates aren’t too important, or you may not wish to think to this level of detail in your initial planning stages.
However what can be important is the date of an event relative to one another. For example, you know that it is important in your story that a second murder takes place 3 days after the first one. Aeon Timeline allows you to convey this on a timeline without having to give exact dates. This is done using “Relative Dates”, where the start and end dates of an event are given as relative to an arbitrary “zero date”.
Types of Relative Dates
There are three types of relative dates:
Weekly:
Weeks count forward or backwards from zero, ie. Week 0, Week 1, Week 2 etc. Events can be specified as occurring on a specific day or time during that week (eg. 10 am Monday Week 6)
Daily:
Days count forwards or backwards from zero, ie. Day 0, Day 1 etc. Events can be specified as occurring at a specific time during the day (eg. 10 am Day 3)
Time:
Time counting forwards or backwards from zero, ie. 02:32:34 or -12:45:00
Setting up Relative Dates
To set up your project to use Relative Dates, choose the relevant template when creating your file (eg. Fiction/Novel etc.) and choose “Customise” at the bottom right hand side. Choose which option you wish to use to map your relative dates (Daily, Weekly or Time) and continue with the template wizard to create your file.
Now you can add events and entities to your project as normal, but with the relative start and end dates. The time scale bar on Timeline View has been changed to use these dates as well.
Changing Your Relative Dates to Absolute Dates
Once you have planned out the events of your story in relation to one another, you might then wish to convert them back to absolute real world dates.
Open Timeline Settings
and under the Calendar & Date tab, choose “Absolute (Regular dates) from the Calendar Style dropdown.
This will bring up a popup asking you to pick the zero date you wish to use. All events in your timeline will be converted based on their relative offset from this zero date. For example, if you choose a zero date as 1 Jan 2016, then “Day 2” becomes 3 Jan 2016 etc.
Once you have chosen this date and applied your settings changes, your events will convert to use absolute dates.

# 149-chronological-vs-narrative-order

Chronological vs Narrative Order
Aeon Timeline supports two different approaches to ordering events within your timeline:
Chronological Order
: represents a date-based, sequential order of events as they actually occurred (even for items that have not yet been allocated dates).
Narrative Order
: represents the order in which events (and other items) are introduced within a narrative or presentation of the timeline data
The chronological order can be considered the default order of events. It is the order used in the majority of views (including Timeline, Spreadsheet, Subway and Relationship Views), and it is the order that is used when determining whether
dependencies and constraints
are correctly met.
Every item that can be included in the chronological order (as determined by its Item Type) will always be included somewhere within the chronological order.
In contrast, the narrative order takes an opt-in approach where the user must deliberately choose to use it (and in fact, some templates will turn it off entirely by default). Items must be manually added into the Narrative or Outline views (or dragged into these views from other views) to be included in the narrative.
Importantly, it is possible for items to exist in just the chronological order, just the narrative order, or to appear in both chronological and narrative orders: for fiction writers, this allows you to model more backstory in your timeline than you intend to include in your final story, or to add elements into your story narrative that do not correspond with dates or real events within a chronological view of your story.
Enabling/Disabling Narrative
Narrative-based ordering is not going to be relevant for all projects and all industries. For this reason, it is possible to disable the narrative entirely in Timeline Settings.
When the narrative is disabled, the application does not maintain a separate narrative order and hierarchy, and the views that use the narrative order - Narrative View and Outline View - are also disabled.
The benefits of maintaining two distinct orders
For storytellers, there are multiple benefits to have two distinct orders for your events.
Stories that are non-linear, involving flashbacks or time travel will benefit from the ability to view and create both the chronological order of events and the order they occur in the story.
Further world building can be mapped out on the timeline, such as backstories or contextual world events, without polluting the narrative of your story.
Events can appear in your narrative that don’t make sense to chronologically track in the timeline (eg. Dream sequences)
Beyond storytelling,  the separate narrative order can be useful in many other contexts where presentation of data is involved:
In a legal setting, the narrative can be used to construct the intended presentation of data to the courtroom
In a historical timeline, the narrative can be used to decide which events from a historical timeline should be presented during a lecture
Chronological Order
Chronological order represents the date-based sequence in which events actually occur. Events are sorted by the date of an event, where it exists, and otherwise by a manual ordering.
Which items appear in chronological order?
Generally speaking, items that are considered to be
events
(based on the item's type) are included in your chronological order. This includes item types such as:
Event, Backstory, Flashback, and Flash-forward within a fiction template
Epics, Stories, and Tasks within project management templates
Events, Facts and Testimony within legal templates
An item type must allow dates in order to be included in the chronological order, but not all item types that allow dates are necessarily included  (e.g. a Person with birth and death dates is configured to allow dates, but is not usually considered to be event-like and included in the chronological order). You can modify which items are allowed in this order in Advanced Settings.
Although items must be allowed to have dates in order to appear in chronological order, they are included even if no dates are set. This allows you to determine the relative order of events prior to setting actual dates, which can be useful during the early stages of plotting a novel or planning a project.
How is the chronological order determined?
First and foremost, an item's start date is used to determine its position within the chronological order. Items within this ordering are automatically sorted whenever their dates change to ensure that this date-based ordering is always preserved. When this sorting occurs, items without dates will maintain their relative position compared to other items as much as possible.
The easiest place to view and re-order items is using the Spreadsheet View, with the columns sorted by the chronological order column (the column with the # heading). Dragging items up and down within this spreadsheet view will adjust their position within the chronological order:
Items without dates can be dragged to any position within the order (and they will not be given dates when this occurs).
Items with dates can also be dragged anywhere, but their dates will be adjusted if you drag the item past an item with a conflicting date.
Re-ordering dates in Relationship View or Subway View will affect the chronological order in the same way (including triggering date changes if required).
Dragging items in timeline view, or editing their dates directly, may also affect chronological order if the new date requires a shift in order to keep events sequential.
Which views use chronological order?
Timeline View
Timeline View provides a linear view of events across time, with events displayed chronologically from left to right to match the corresponding dates along the top. If items share the same date, their vertical order is determined by the chronological order (i.e. higher items in the Spreadsheet View will also appear higher on the Timeline View). Only events that contain dates are displayed on the timeline.
Spreadsheet View
Events are ordered chronologically from top to bottom. Events are automatically ordered by date, however events don’t have to have a date to appear in the spreadsheet view so you can manually alter the order of these events by clicking and dragging them in the list.
Item hierarchies can be used to group items underneath parents, in which items will be sorted by chronological order at each level of the hierarchy tree.
Relationship View
Behaviour is the same as the Spreadsheet View, listed above.
Subway View
Events are ordered chronologically from left to right wth an even spacing (unlike Timeline View, Subway View is not linear and does not represent the relative time spacing between items).
Narrative Order
Narrative order is a structured order for events which is independent of their dates. The events are contained in a hierarchical structure with the ability to give labels such as “Part”, “Chapter” and “Scene”.
Which items appear in narrative order?
The narrative order will contain a mixture of date-based items that can appear in both the chronology and narrative, and narrative-only items. As with narrative order, the types of items is determined by your chosen template. To use fiction templates, as an example:
Event, Flashback, and Flash-forward items can occur within both the narrative and chronological orders, as they are events that occur at a real place and time that might be included within the Narrative and Timeline.
Folders or Narrative parts occur only within the Narrative (these are typically used to create a hierarchy within the narrative, such as dividing scenes into Chapters and Parts).
Backstory items can appear within the chronology but not the narrative (because by definition, they are elements of world-building that are kept out of the actual story).
Unlike chronological order, items must be explicitly added to the narrative order in order to be included. This can be helpful for people who have more events to plot then will eventually appear in the narrative of their story.
As discussed, the narrative order can be grouped into a hierarchy, allowing events to be divided into Chapters and Parts (for a novel) or Acts and Scenes (for a screen or stage play) that better reflect the overall structure of the narrative story. This is different to the general item hierarchy that is created by setting item parents: in effect, the narrative maintains its own distinct hierarchy as well as order).
How are items added to the narrative?
There are several ways to add items into the narrative.
Existing items:
Existing items can be dragged into Narrative View or Outline View from another view to add that item into the narrative.
Existing items can also be added into Narrative View by clicking on an Add button within the view (these are located at numerous points within the hierarchical tree) and selecting an existing item from the dropdown
New items:
New items can also be created directly in the narrative by using the Add button in the Narrative View, or by typing a label into the empty row at the bottom of the Outline View
New items will also be directly added to the narrative if a Narrative View or Outline View is the focused view when adding items via the Sidebar or Item menu (provided the chosen item types are allowed to be included in the narrative).
When adding new items to the narrative, if that type is allowed in the chronological order, it will be added automatically to the end of the existing chronology.
Which views use narrative order?
Narrative View
Narrative view is a card layout of the narrative order. The order runs from top to bottom, left to right with cards displayed within one another to show the hierarchical structure.
Outline View
Outline View is the narrative-order equivalent of the Spreadsheet View. Items are sorted from top to bottom according to the narrative order. Where the narrative includes a hierarchy, this will be reflected in the tree structure of the Outline View.

# 150-how-to-use-story-arcs

How To Use Story Arcs
A story arc is a continuing storyline or plot thread that exists in a novel or story. It is a term used to describe the path of a story and the buildup of and letdown of suspense and tension as the plot unfolds.
Within a larger story, there can be smaller arcs. These may often follow plot lines of characters other than the protagonist, or secondary motivations of the main character.
For example, Lord of the Rings: the Two Towers contains multiple story arcs, including:
Frodo and Sam’s journey to destroy the Ring
Aragorn, Legolas and Gimli’s travel journey to Rohan
Merry and Pippin’s meeting of the Ents.
These are all different plot lines that happen concurrently throughout the novel. Aeon Timeline allows you to sort your events into different story arcs so you can track them independently and relative to one another.
The following steps describe how to setup your timeline to use Arcs:
1. Add Arcs to Your Timeline
To add a story arc to your timeline, click the Story Arc icon on the toolbar on the left to open the Story Arc panel. Click “Add New Story Arc” to add a new Arc. Give the Story Arc a name, and edit any other information (such as adding notes or relationships) via the Inspector. Add as many arcs as you like by clicking the “Add” button in the top right of the panel.
You can also add Arcs quickly by clicking the ‘+’ sign on the toolbar and choosing “Story Arc”
2. Assign Arcs to your Events
You can assign what story arc your event belongs to via the Inspector.
Click on the event and click on the relationships tab in the inspector. Click the plus sign next to Story Arc and choose the arcs you wish to add from the dropdown list. You can also assign arcs to events in
Relationship View
or
Spreadsheet View
.
3. Filter your Events by Arc
To help visualise your plot-lines you can filter your events by arc. Click on the Story Arc symbol on the left toolbar, and click on the filter symbol (
)
next to the story arc you wish to filter by.
Divide your screen into multiple views by clicking the split screen icon (
) in the top right of the view, and add different filters to each window to view your different story arcs concurrently.
4. Use Subway View to Analyse your Arcs
Subway View lays out the events associated with each arc along “tracks” like a subway map, allowing you to analyse the chronological progression of your story arc without worrying about the time scale or their dates.
Choose the “Separated” option to analyse a story arc in isolation, or “Subway” to analyse the intersection your story arcs as your story unfolds.

# 153-viewing-your-data

Viewing Your Data
Aeon Timeline 3 contains many different views which help you visualise and organise your data in different ways. You can use as few or as many as you like, choosing which ones bestsuit your needs the most.
Timeline View
Timeline view allows you to plot and display your events chronologically across a horizontal timeline. Plot out down to the last second the events of your murder mystery story to determine where everyone was and what was happening at the time, or see how old a character is at a certain event in your story. Map out a chronological display of your client’s emails over time, or plan the timeline for the completion of a project.
More than just a static display tool, the timeline view gives viewing and editing functionality that allows for easy changing and organising of your data as it evolves. Simple clicking and dragging events on the timeline provides quick reordering, while a zoom tool allows you to view your data at different time scales. Analyse the events occurring across a single day, then zoom out to see how they compare across millions of years.
Read more about Timeline View
Spreadsheet View
Spreadsheet view is a simple table that contains events and their associated information. It allows for quick data entry of events and entities without having to enter dates or scroll around a timeline. Get down information about your events quickly without having to stress about the details, and order your events chronologically before giving them dates. The spreadsheet provides all the information about the events in one glance, providing quick editing and viewing capabilities.
Read more about Spreadsheet View
Relationship View
Relationship view is a table view that displays the relationships between events and other items such as characters or locations. It allows for a quick and easy way to view and edit relationships without having to scroll through an event’s data. Discover plot inconsistencies where characters are expected to be in two different places at once or see if an employee has too many tasks allocated to them. See how old characters are at certain events in your story, or see at a glance what historical events took place in a certain country.
Read more about Relationship View
Subway View
Subway view illustrates how events connect with entities across time. Events are laid out along tracks like in a subway map, each track representing a different item such as character, story arc, or employee, with common events shown as intersections on the map. It shows the sequential order of events, without being drawn to scale.
Visualise different project teams and how tasks are shared between them. Plan how your story arcs intersect and develop over time, or when two characters should meet in a story.
Read more about Subway View
Narrative View
Narrative view is an independent structure and order for your events which is different from the chronological/date based order on your timeline. Create a non-linear story order independent of your timeline, useful for novels with flashbacks or time travel, or ordering how you are going to present a case to court.
Divide your events into the chapters and scenes they will exist in, and easily move them around as you make changes to your story.
Read more about Narrative View
Outline View
Outline view is a table view of events in your narrative, stored in a hierarchical list structure. It enables you to quickly edit the events in your narrative, and see all an events associated information at a glance.
Read more about Outline View
Mindmap View
Mindmap view is a freeform space that allows you to draw mindmaps of connected events, people, places and other entities. Show the relationships between characters in your novel, or create a person’s family tree. Plot out the events for your story and how they relate to one another before having to plan out a narrative, or just use it in the brainstorming phase to flesh out ideas before committing to a story or a task.
Read more about Mindmap View
Split View
Aeon Timeline has the ability to split the screen into multiple windows, each showing different views. This allows you to compare different types of data, or different ways to view the data side by side.
Compare different character’s timelines by having filters on multiple windows. Have relationship view open to check a character’s movements while you are planning your narrative, or have your brainstorming mindmap open as you start to plan your project’s timeline.
Split screens gives the ability to easily move data between different views. A simple click and drag of events lets you move them from one view to another. Quickly add all your events via the spreadsheet view, then drag them to the timeline view to start planning their chronological order. Plot out your ideas in a mindmap, and drag them to the narrative view to start planning your story.

# 155-item-hierarchies

Grouping Items into Hierarchies
What Are Hierarchical Groups?
Aeon Timeline allows you to organise items into hierarchical groups or structures. These groups can be used in a number of ways, depending on your industry and data, such as:
Events nested within larger parent events, such as a particular battle nested within a war.
Locations nested within other locations, such as cities within countries.
Project management tasks broken down into smaller units (e.g. tasks broken into sub-tasks, or in an Agile environment, Epics, Stories and Tasks).
Dividing characters in a novel into different groups, such as Protagonists and Antagonist.
When referring to items within the structure, we refer to parent and child items: where Item A contains a number of sub-items grouped within it, those sub-items are child items of Item A; equally, Item A is the parent item of those sub-items. As this hierarchy can extend across many levels, it is possible for an item to be both the child of one item and the parent of another at the same time.
Grouping events within these parent/child structures provides several benefits:
The structure can be expanded and collapsed within several views including Entity Lists and
Timeline
,
Spreadsheet
, and
Relationship
Views, allowing you to limit or increase the amount of detail visible on the screen as required;
Item dates will be extended to
include the date range of their children
;
Item properties can be configured to be calculated from their children: for instance, a country’s population could be calculated as the sum of the child state’s populations; or the percentage complete of a task could be calculated from the percentage complete of the child tasks
Not all item types can be grouped under all other item types. Your chosen template will define which groupings are logical and allowed (e.g. you cannot group a Location under an Event), but this can be changed in Advanced Settings.
Each item can only be grouped under a single Parent item. You can use
Relationships
instead to model more complex relationships, such as assigning a Task to multiple Projects.
Note: The parent/child terminology should not be confused with actual parent/child (i.e. father/mother and daughter/son) relationships between two people. Aeon Timeline can also represent those as Relationships, but they are not created using the same hierarchical structure.
How to group items
There are several other methods to group an item underneath a parent:
With one or more items selected, you can select the item’s Parent from the dropdown list in the Inspector.
In Spreadsheet View, Relationship View, and Entity Lists, drag an item and hover over the parent you wish to drop it on. When the entire parent is highlighted, the item will be added as a child under that group. You can drag an item out of a parent as well to remove its parent association.
In Timeline View, hold down the command (Mac) or control (Windows) key while dragging items to move them in and out of parent items;
To group one or more items under a brand new parent item, select the items and then choose Embed in New Parent under the Item menu.
Subway, Mindmap and Narrative views do not directly represent parent/child hierarchies.
Date Ranges for Parent Items
In general, items within Aeon Timeline have a start date, duration, and end date.
This is also true for parent items: they can be given specific start and end dates, which remain independent of any dates given to their child items. This allows longer events such as “World War 2” to track their own start and end dates (e.g. 1939 - 1945); child items grouped under “World War 2” will then have their own start and end dates (e.g. July - October 1940), but the parent item does not need to have child items that span the entire duration of the child.
This works well in most situations, as the range of child events will usually be contained within the parent event (the usual case).
However, in some circumstances, you may create a child with dates that fall outside the range of the parent event. When this occurs, the dates set for the parent will be interpreted as preferred dates, but will be extended to include the range of the child dates for purposes such as calculating dependencies.
This will usually represent an error or intermediate state that will need to be resolved in the future (e.g. by moving the child back within the range of the parent, or by extending the parent’s dates to accommodate the child), so when this occurs, the discrepancy will be highlighted to you in a number of ways:
Timeline View
In the
Timeline View
, child dates exceeding the parents’ dates will be indicated with error bars attached to the parent item:
Inspector
In the Inspector, an additional field will show the calculated date range (the maximum range of the parent and child dates):
Spreadsheet View
In
Spreadsheet View
, any date that is exceeded by child dates will be highlighted in red. The user can also choose to turn on an optional column to show the child range:
Note: The way parent and child date ranges are handled is a departure from version 2, where parent events dates were always calculated solely from the dates of their children, and placeholder child events could be used to be added to mark the start or end of a parent event if required).
Moving Parent and Child Dates
By default, when you change the date of a parent item, all of that item’s children will be adjusted by the same amount, keeping them within the same relative offset from each other. This makes it easy to move around groups of events (e.g. delay the start of a task, which should therefore delay any sub-tasks contained within the task), but may not be preferable in all cases.
To prevent a child from moving with its parent, you have two options:
If it is a small number of child items you want to remain fixed, you can lock that child using the Inspector so that its dates cannot be changed;
You can change the default behaviour in Timeline Settings;
Note that some templates (such as Historical templates) reverse the default behaviour so that children do not move with parents. This is because in these fields, where exact dates are known or have been entered, you are unlikely to want any dates to be automatically adjusted.

# 160-global-and-local-filters

Global and Local Filters
As your timeline becomes more complex, it can be useful to reduce the visible items to show only those that are relevant to your current workflow.
Filters can be applied globally across all views, or locally to a single focused view. The latter option allows you to apply different filters to each view in your timeline, making it possible to compare different sets of data side by side (e.g. two local filters could allow you to compare the events allocated to different people).
Note: As iPhone only shows a single view, there is only a global filter for the iPhone, which affects all views except for entity lists.
The ability to apply different filters to each view provides a more flexible and user-friendly replacement for the “Group By” functionality of version 2. In version 2, if a user wanted to compare the timelines of two people, they would choose Group ByPerson, and would be shown separate groups for every different Person in the timeline at once.
Now, you can configure two or more separate split views with independent filters, and those resulting views can be independently scrolled, making it easier to view and compare the relevant information on a single screen.
As filtering by a single entity such as Person is a common workflow function, you can access a quick shortcut to apply a filter directly from Entity Lists (see
Shortcuts to Entity Filters
below).
The Filter Panel
You can configure both global and local filters within the Filter Panel, which is accessed by clicking on the filter icon (
) in the Sidebar.
The Filter Panel will default to affect "All Views" (i.e. the Global Filter) each time it is opened, meaning that any filters you apply will affect every view in the timeline equally.
If you wish to change filter settings for the focused view only, then you should click on the "Focused View" tab at the top of the filter panel. You can read more about split views and the Focused Views in our User Interface Overview article.
To reduce screen clutter, only four commonly used filter options (Color, Type, Tags, and Date) are initially visible when you open the filter bar, but you can access a wider range of filter options by clicking on the
More Filters
button at the bottom of the existing list.
Changing Filter Settings
Enabling a Filter Condition
Filters are created by combining one or more filter fields (criteria) to determine which items should remain visible. Each filter criteria consists of a field and value.
To begin filtering by a particular field:
Choose whether to apply the filter to All Views or just the Focused View
Ensure the field is visible in the Filter Panel. if it is not visible, click on the
More Filters
button to add it to the visible list.
Click on the disclosure arrow (
) to expand the field
Depending on the field type, select or type the values that you wish to use for the filter:
Some filters such as Color or Type will allow the user to select from a list of checkboxes
Longer lists, such as entities, require each individual item to be added from a dropdown list to save space
Date and numeric fields will allow the user to enter a range of allowed values
Text fields will allow the user to enter any terms the filter must match
Some fields will also allow the user to determine the logic that should be applied if multiple values are provided (i.e. does an item need to match All provided values, Any of the values, or None of the values).
When specifying filter criteria, you are always specifying the conditions an item must meet in order to be displayed (that is, those items matching the filter are displayed, and those items not matching the filter are hidden).
Adding further conditions
With one field configured, you can then add further fields to your filter as required.
Once more than one field is applied to the filter, an additional option will be added to the top of the Filter Panel to determine how the individual filter criteria should be combined:
Match All
: Items in your timeline view must match all of the applied filter conditions.
Match Any
: Items in your timeline view must match any of the applied filter conditions.
For those familiar with boolean fields, ‘Match All’  is the equivalent of the AND operator, while ‘Match Any’ is the equivalent of the OR operator.
Removing filter conditions
To remove a criteria from your filter, click on the
Clear
button alongside the relevant field name.
To remove all criteria and disable the filter completely, click on the
Clear
button at the top of the Filter Panel alongside the
Current Filter
label.
Saving Filters
If you wish to save a commonly used filter, you can click on the
Save
button alongside the
Filter
label, and then enter a name for the saved filter.
Once saved, the filter will appear when you click
Load
at the top of the filter panel. Clicking on a saved filter will immediately apply the filter, replacing any existing filter.
You can delete a saved filter by clicking on the delete icon (
) alongside the filter name (which will appear with the
Load
list expanded).
Applying Automatic Filters
When working in a filtered view, if you add a new item Aeon Timeline will automatically apply eligible filters. For example, if you are working within a view with the filter 'Place:Australia' applied, when you create a new item in that view a relationship with Australia will be automatically created.
Filters for all views and the selected view are both considered.
Filters that will be automatically applied include relationships, colours, boolean and list properties. Dates, items types and text properties from filters will not be applied.
When you drag existing items into filtered views rather than creating new items, it will attempt to apply the filter criteria, but will not overwrite any existing values.
How views apply the filter
For chronologically-ordered views (Timeline, Spreadsheet, Relationship and Subway Views), the following rules apply:
Items that match the filter criteria are displayed as normal
Items that do not match the filter criteria, but contain children that do, will be shown with a faded appearance, to ensure the overall structure of the data is retained
Items that do not match the filter criteria, and whose children also do not match the filter, are removed from the view completely
Note: Criteria 2 does not apply to Subway View, as it does not show parent/child relationships.
For the remaining views (Narrative, Outline, and Mindmap), items that do not match the filter criteria are faded rather than hidden completely. This is because the visual position of items in those views is only really relevant in relation to the items around them, and too much context would be lost if those events were hidden completely.
Shortcuts to Entity Filters
One of the most common reasons to apply filters is to view events associated with one specific item, such as an individual person or project. For this reason, Aeon Timeline 3 provides an additional shortcut approach to apply a local (Focused View) filter directly from the Entity List Panel.
To apply a filter in this way:
Open the Entity List by clicking on the relevant item type icon in the Sidebar
Click on the Filter icon (
) alongside the entity you wish to include in the filter
This will adjust the filter for the Focused View to show only items matching this item (the global "All Views" filter is not affected). When applying this new filter, any existing filter condition affecting the same item type will be replaced. For example, adding a filter for "Person A" will replace an existing filter for "Person B".
All other Focused View filter conditions affecting other fields will be retained.
If you instead wish to preserve the existing filter criteria for the same item type, you can hold the Cmd (Mac) or Ctrl (Windows) key when clicking on the filter icon, and the entity will be added to the existing filter criteria instead.

# 165-dates-and-durations

Dates and Durations
Unsurprisingly, dates form an intrinsic part of the data you will enter into your timeline. This article outlines the way dates are stored and represented inside Aeon Timeline, and the various options available to represent events in your timeline as accurately as possible.
In the simplest cases, Aeon Timeline tracks three key properties for events:
Start Date
This represents the date or time when an event started (or is scheduled to start). Depending on your settings, it will be represented as either an absolute date (e.g. 23 June 2021), or a relative date (e.g. Monday, Week 3).
Duration
This represents how long an event will last, recorded as a number of years, months, days, etc. (e.g. 5 days, 4 hours). If a duration is not specified, it will default to an instantaneous event (i.e. a duration of 0 seconds).
End Date
This represents the date or time when an event ended (or is scheduled to end). Again, this will be represented as either an absolute or relative date, depending on settings.
You do not need to commit to dates for your items until you are ready:
When you are first starting with your timeline, you may wish to brainstorm a series of events or tasks without allocating them specific dates.
It is even possible for an item to have a duration without yet having any associated dates (e.g. if you are estimating the length of time a task will take, but don't yet know when it will fit into your schedule)
Once an item has both a date and duration, the three fields (start date, duration, and end date) are always kept in sync to ensure they are mathematically correct. Under default settings:
Item duration will be preserved when changing the start date, which means the end date will be recalculated (thus ensuring an item retains the same duration as it is dragged around the timeline).
An item start date is preserved when changing the duration or end date, meaning the end date or duration will be recalculated respectively.
An item's end date can never be before its start date (i.e. an item cannot have negative duration). If you modify an end date to occur before its start date, the change will be rejected.
Date precision
Aeon Timeline handles time down to the second precision. However, it is not always necessary or practical to enter dates to such exacting measurements, so you can instead choose to enter dates with less precision as is appropriate for your data. There are several reasons you may wish to do this:
An event may be a historic event where the exact date or time is unknown, only an approximate value such as a year (see also, Uncertain dates below)
An event may take place over an entire day, week, month, or year, so specifying more precise time doesn’t make sense.
A fiction writer may not need precision down to exact dates/times, in which case making up these values is an unnecessary distraction and clutters up the timeline with unnecessary information.
Aeon Timeline allows you to specify varying levels of precision for each item, so you can mix and match events that are specified to the second with events that only contain a year.
How precision is calculated
The precision for an item will be determined by the maximum precision of the start date and duration that you enter.
For instance, if you enter a start date of 2012, and a duration of 3 years, Aeon Timeline will only display year information on the timeline.  (ie. 2012 - 2014).
Conversely, if you enter 2012 and 2 months, the event precision is now months, and a date value of January - February 2012 will be shown instead.
How imprecise events are displayed
Although more precise date information is not usually displayed on the timeline, the item still needs to be positioned on the timeline relative to other items. Aeon Timeline treats start and end dates as inclusive, and thus uses the following rules to determine where an item should be displayed when the information is uncertain:
Start Dates
If time is not specified, it will default to the beginning of the specified day (represented as 00:00:00).
If the day of the month is not specified, it will default to the beginning of the month.
If the month is not specified, it will default to the beginning of the year.
End Date
If the time is not specified, it will default to the end of the day (represented as 24:00:00).
If the day of the month is not specified, it will default to the end of the month.
If the month is not specified, it will default to the end of the year.
Representing end dates and midnight
There is an ambiguity in the way we naturally talk about dates, and a precise mathematical representation of the date themselves.
To provide an example, consider an event that begins on 1 January 2021 and lasts for three months. For most people, the natural interpretation of this is that the end runs from January - March 2021, and so concludes at the end of 31 March 2021. Mathematically, however, this event would be considered to start at midnight on 1 January 2021 (that is, the start of January 1), and its end date would be midnight on April 1, 2021 (that is, 1 April 2021 at 00:00:00).
Aeon Timeline's date reasoning attempts to keep more in line with the former, natural interpretation of events, which is achieved using the inclusive interpretation of events listed above.
This means that:
An item with start date 2021 and duration 2 years will be represented as 2021-2022 (or, more precisely, 1 January 2021 to 31 December 2022).
An item with start date of January 2021 and duration 2 months will be represented as January 2021 to February 2021 (or 1 January 2021 to 28 February 2021)
An item with a start date of 1 January 2021 and a duration of 3 days will be represented as 1 January 2021 to 3 January 2021
In order to remain consistent with this approach, we apply this same philosophy even when time is specified as part of a date, which leads to one additional rule:
When an item's end date is at midnight, we choose to represent this as 24:00 of the day before, rather than 00:00 of the day after (that is, the end of the previous day, rather than the start of the next).
Although referring to a time of 24:00 is less common than the 0:00 alternative, it is a widely accepted alternative representation of midnight, and one we feel provides great benefit in ensuring consistency of date handling across the application.
Ongoing Items
Sometimes, it is necessary to represent items on your timeline that have not yet ended, and whose end date is therefore undetermined:
A person still living, who does not yet have a date of death
An event that is still in progress and with an unknown end (e.g. in 1942, World War 2 was ongoing and its end date was unknown).
For these events, Aeon Timeline allows you to specify an item is
Ongoing
(this is done using a checkbox in the Item Inspector). When an item is marked as ongoing, its end date and duration fields are disabled, and the timespan of the item is listed as "XX - Present".
On the timeline, ongoing events are drawn up to today's current date, but with a faded arrow ending to show the event will continue into the future.
Uncertain Dates
For some items, it is not possible to express item dates with absolute certainty. This can be for a variety of reasons, such as:
In historical contexts, some information was destroyed or simply not recorded, and so exact information is unknown;
In project management contexts, it is not always possible to predict exactly how much time a task will take, and it is therefore not possible to know exactly when the next task will start
The boundaries of a more abstract item may be fuzzy and unclear: the beginning of an Art Movement, or a growing relationship between two people
We have already mentioned one way to handle this uncertainty: by specifying item dates using a lower precision, such as just a month or year, rather than an exact day.
Aeon Timeline also offers a further, more advanced approach, which allows you to enter four dates instead of the usual two:
Start Date
The Start Date is reinterpreted as meaning the
earliest possible start date
for the item. That is, the item may start later, but it definitely did not start before this date.
Latest Start (new)
The
latest possible start date
for an item. That is, the item must definitely have started by this date.
Earliest End (new)
The
earliest possible end date
for an item. That is, the item may end later than this date, but it definitely did not end before this date.
End Date
The End Date is reinterpreted as meaning the
latest possible end date.
In other words, the event is known to have started somewhere between its start date and its latest start date; and the event is known to have ended somewhere between its earliest end date and its end date.
As these are advanced fields that will not be necessary for most users, you will need to click on the disclosure arrows next to the original date fields in the Inspector (or calendar date picker) in order to access them.
You may choose to use just one or both of the advanced fields:
It may often be the case that the date of death for a famous historical figure may be well known, but their date of birth is a mystery; in that case, you can specify both an earliest and latest possible start date, but use a precise end date.
Uncertain dates in text
Aeon Timeline uses the tilde (~) character to represent these approximate date ranges when showing them in text associated with an item (e.g. when item dates are shown underneath an item in one of the views).
Uncertain dates on the Timeline
In the Timeline View, uncertain dates are represented with a fuzzy gradient stretching between the earliest and possible dates.
Date Styles
Most Timelines will use absolute dates, meaning that you specify an exact date or year for each event on your timeline.
Aeon Timeline also allows for several other timelines ‘styles’ that allow you to specify times relative to a theoretical ‘zero’. Uses for these relative timelines include:
Planning a fiction story without needing to think about specific dates and times.
Planning a project or development schedule based on weeks before you know a definite kick off date.
Planning a seminar or training workshop that you will repeat many different times.
Planning screen or stage time in a movie, where you want to map out scene times over a period of several hours.
Setting the Date Style
The timeline style can be set and adjusted in the ‘Date & Narrative’ section of Timelines Settings.
Regular dates: Dates are represented in the normal way as absolute values (a specific day/month/year).
Weekly: Weeks count forward from zero, ie. Week 0, Week 1, Week 2. Events can be specified as occurring on a specific day or time during that week. For example, ‘10:00 Monday Week 6’.
Daily: Days count forward from zero, ie. Day 0, Day 1, Day 2. Events can be specified as occurring at a specific time during that day. For example, ‘10:00 Day 3’.
Time: Time counting forwards or backwards from zero, eg. 02:32:34 or -12:45:00.
Setting the ‘Zero Date’
When you change from regular dates to any of the weekly formats, or vice versa, you will be asked to specify the date to be used as ‘zero’ in your conversion. All existing dates in your timeline will be converted based on their relative offset from this zero date.
For instance, if you convert from Regular Dates to Daily using a zero date of ‘1 Jan 2020’, existing dates would be converted as follows.
January 1 2020 becomes ‘Day 0’.
January 3 2020 becomes ‘Day 2’.
January 5 2020 12:00pm becomes ‘Day 4, 12pm’
January 3 2020 - January 7 2020 becomes ‘Day 2-6’

# 178-how-to-add-item-types

How To Add Item Types
Customising Settings When Choosing A Template
When you first open Aeon Timeline you will need to choose a template before you can begin any other work on your timeline. You can customise which item types you wish to add by ticking the box next to a particular type. If you wish to remove items from visibility in your timeline, you then just need to untick the box next to the type you wish to remove.
Settings
When you're working on your timeline, you can adjust which items types are visible in your timeline by going to the Settings:
When you open these, go to 'Data Types'. When you click on this, you will see the 'Item Types' section. Click the 'Edit' button next to 'Item Types'.
To create a new Item Type, click "Add" at the bottom of the list of existing types.
You can read about the settings you can configure for your new item type in
Advanced Settings: Item Types

# 181-how-to-handle-uncertainty-in-dates

How To Handle Uncertainty in Dates
When creating your timeline, you may be working with dates that are uncertain or not yet known. Aeon Timeline allows you to customise dates to reflect uncertainty with the following steps:
First, you need to select the item which has an uncertain date and open the inspector. Ensure you have the dates tab open by clicking this icon :
If the Start date is uncertain click
next to the box where you write the start date.
You will then be given the option to implement and 'Earliest Start' and 'Latest Start'.
Here, implement the earliest possible start date and the latest possible start date that could apply to this item.
4. When viewing this item in your timeline, you will see the range of this uncertain date represented as a line that fades to full resolution, and appears as full resolution once they reach the latest start date.
This process works similarly for uncertain end dates, although instead of fading in, the range of the uncertain date will fade out from the earliest end date to the latest end date.

# 223-how-to-create-relationships-between-items

How to create relationships between items
You can add items to your timeline using any of the following methods:
Add relationships using Relationship View
Change your view into Relationship View
Click on "Choose Columns", and select the entities you want to show along the top of the view
The intersection between each row and column will show relationships that exist between those items
Click on an Intersection to see a dropdown of the available relationship types
Click on a relationship type to toggle that option on or off
Add relationships in the Inspector
Select the event or other item to which you want to add relationships
If the Inspector is not visible, show it by clicking on the Toolbar icon (Desktop-only)
Change the inspector tab to the Relationship tab (person icon)
Existing relationships will be listed
Click on the + next to an existing relationship type, or click on "Add Relationships" to choose from more relationship types
Select the name of the item you want to add the relationship to
Add relationship in Mindmap View
To create relationships between two existing nodes in Mindmap View:
Hover your mouse over one of the items until the Connector icon appears
Click and drag from the connector icon to the other item you want to create a relationship to (a line will be shown following your mouse, and the item will highlight when you hover over it)
Release the mouse, and select the type of relationship you wish to create
You can repeat this process to remove an existing relationship also
Note: to add existing items to a Mindmap, drag them in from any other view.
Add or drag items into a filtered view
When you create a new item or drag an existing item into a filtered view, it will automatically assign relationships to match the current filter.
Setup a local filter for the view by clicking on the Filter icon next to an item in an Entity panel
Drag items from another view and drop them into the current view
A relationship will be created between the dropped item and any items used in the filter (the default relationship type between those item types will be used)
When creating an item directly inside that view, relationships will be created for the new item also
Note: The Filter Panel (global or focused view) can also be used to create automatic relationships, as well as other properties that can be automatically assigned.

# 234-switching-view-types

Switching View Types
How to change view types
Desktop
If you have more than one split view open, click on the view you want to change to make sure it has focus (the focused view will be highlighted with a brighter header color)
In the toolbar, click on the view name you wish to select
Note: If your window is small, the toolbar may show icons only. Hover over the icons to see the name of each view.
Tablet
If you have more than one split view open, tap on the view you want to change to make sure it has focus (the focused view will be highlighted with a brighter header color)
In the toolbar, tap on the view selector, and then tap the name of the view you want to see in the menu
Mobile
Portrait orientation:
Click on the Clock icon (
) in the bottom toolbar to view a Chronological list of items
Click on the Book icon (
) in the bottom toolbar to view items listed in Narrative order
Landscape orientation:
Click on the Clock icon (
) in the toolbar to open Timeline View
Click on the Book icon (
) in the toolbar to open Narrative View
How to open two different views
Desktop
Split your workspace into two different views by clicking on the split icon (
) in the workspace header
Click into the top view to give it focus
In the toolbar, click on the view name you want to open
Click on the second view to give it focus
In the toolbar, click on the view name you want to open
Tip: You can hold down the
Alt/Option
key to split the view horizontally instead
Tablet
Tap on the split icon in the toolbar (
or
)
Tap on your preferred split layout in the menu
Tap on the top view to give it focus
In the toolbar, tap on the view selector, and then tap the name of the view you want to see in the menu
Click on the second view to give it focus
In the toolbar, tap on the view selector, and then tap the name of the view you want to see in the menu